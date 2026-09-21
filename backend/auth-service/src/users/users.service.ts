import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

export interface UserWithRolesAndPermissions {
  id: string;
  username: string;
  fullName: string | null;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Admin/service-level user provisioning. This is the ONLY way users
   * enter the system — there is no open public self-registration, by
   * design (see spec section 5).
   *
   * Intended to be called either by the protected `POST /auth/users`
   * endpoint (SUPER_ADMIN only) or, later, directly by the Employee
   * Service when it provisions a new hire.
   */
  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const normalizedEmail = this.normalizeEmail(dto.email);

    const [existingEmail, existingUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: normalizedEmail } }),
      this.prisma.user.findUnique({ where: { username: dto.username } }),
    ]);

    if (existingEmail) {
      throw new ConflictException('A user with this email already exists');
    }
    if (existingUsername) {
      throw new ConflictException('A user with this username already exists');
    }

    const roles = await this.prisma.role.findMany({ where: { name: { in: dto.roles } } });
    const foundRoleNames = new Set(roles.map((role) => role.name));
    const missingRoles = dto.roles.filter((name) => !foundRoleNames.has(name));
    if (missingRoles.length > 0) {
      throw new NotFoundException(`Unknown role(s): ${missingRoles.join(', ')}`);
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: normalizedEmail,
        fullName: dto.fullName,
        passwordHash,
        isActive: true,
        // Admin-provisioned users get a temporary password and must
        // set their own on first login.
        mustChangePassword: true,
        userRoles: {
          create: roles.map((role) => ({ roleId: role.id })),
        },
      },
      include: { userRoles: { include: { role: true } } },
    });

    return this.toUserResponse(user);
  }

  async findByEmailForAuth(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    });
  }

  /**
   * Used by JwtStrategy on every authenticated request, and by AuthService
   * right after login, to resolve the user's current roles/permissions
   * fresh from the database (never embedded in the JWT beyond role names).
   */
  async findActiveUserWithRolesAndPermissions(
    userId: string,
  ): Promise<UserWithRolesAndPermissions | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return this.toRolesAndPermissions(user);
  }

  async findById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async listUsers(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      include: { userRoles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => this.toUserResponse(user));
  }

  async getUserOrThrow(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  async setActiveStatus(userId: string, isActive: boolean): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      include: { userRoles: { include: { role: true } } },
    });

    return this.toUserResponse(user);
  }

  /**
   * Updates profile fields and/or the full role set for a user.
   * Username is intentionally not editable here — treat it as a stable
   * identifier; changing it is a separate, rarer operation if ever needed.
   */
  async updateUser(userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const data: { fullName?: string; email?: string } = {};

    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName;
    }

    if (dto.email !== undefined) {
      const normalizedEmail = this.normalizeEmail(dto.email);
      if (normalizedEmail !== existing.email) {
        const emailTaken = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (emailTaken) {
          throw new ConflictException('A user with this email already exists');
        }
      }
      data.email = normalizedEmail;
    }

    if (dto.roles) {
      const roles = await this.prisma.role.findMany({ where: { name: { in: dto.roles } } });
      const foundRoleNames = new Set(roles.map((role) => role.name));
      const missingRoles = dto.roles.filter((name) => !foundRoleNames.has(name));
      if (missingRoles.length > 0) {
        throw new NotFoundException(`Unknown role(s): ${missingRoles.join(', ')}`);
      }

      // Full replacement of the user's role set, not a merge — matches
      // the same "PATCH replaces what's provided" contract used for
      // role-permission updates in RolesService.
      await this.prisma.userRole.deleteMany({ where: { userId } });
      await this.prisma.userRole.createMany({
        data: roles.map((role) => ({ userId, roleId: role.id })),
      });
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { userRoles: { include: { role: true } } },
    });

    return this.toUserResponse(user);
  }

  /**
   * Admin-initiated password reset (e.g. "I forgot my password, ask IT").
   * Sets a new temporary password chosen by the admin, forces the user
   * through the first-login reset flow again, and revokes every active
   * session so a possibly-compromised old password can't keep a session
   * alive.
   */
  async adminResetPassword(userId: string, temporaryPassword: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await argon2.hash(temporaryPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.prisma.refreshTokenSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async updatePasswordHash(userId: string, newPasswordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        // A successful password change always clears the "must change"
        // flag, whether it was true (first login) or false (routine change).
        mustChangePassword: false,
      },
    });
  }

  private toRolesAndPermissions(user: {
    id: string;
    username: string;
    fullName: string | null;
    email: string;
    isActive: boolean;
    mustChangePassword: boolean;
    userRoles: {
      role: { name: string; rolePermissions: { permission: { name: string } }[] };
    }[];
  }): UserWithRolesAndPermissions {
    const roles = user.userRoles.map((userRole) => userRole.role.name);
    const permissionSet = new Set<string>();
    for (const userRole of user.userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissionSet.add(rolePermission.permission.name);
      }
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      roles,
      permissions: Array.from(permissionSet),
    };
  }

  private toUserResponse(user: {
    id: string;
    username: string;
    fullName: string | null;
    email: string;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    userRoles: { role: { name: string } }[];
  }): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      roles: user.userRoles.map((userRole) => userRole.role.name),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
