import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Login flow (spec section 6), steps 1-11.
   * Intentionally returns the SAME generic error for "no such user",
   * "wrong password", and "inactive account" — see spec section 15.
   */
  async login(dto: LoginDto, metadata: RequestMetadata): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailForAuth(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissionSet = new Set<string>();
    for (const userRole of user.userRoles) {
      for (const rp of userRole.role.rolePermissions) {
        permissionSet.add(rp.permission.name);
      }
    }
    const permissions = Array.from(permissionSet);

    await this.usersService.updateLastLogin(user.id);

    const { accessToken, refreshToken } = await this.issueTokenPair(user.id, roles, metadata);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        roles,
        permissions,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Refresh flow (spec section 8). Rotates the refresh token on every
   * use: the old session is revoked and a brand new one is issued, so a
   * stolen-and-reused old refresh token is immediately detectable
   * (it will already be revoked).
   */
  async refresh(rawRefreshToken: string, metadata: RequestMetadata): Promise<AuthResponseDto> {
    let payload: { sub: string; sessionId: string };
    try {
      payload = this.tokenService.verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const session = await this.prisma.refreshTokenSession.findUnique({
      where: { tokenHash },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.usersService.findActiveUserWithRolesAndPermissions(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Account is not active');
    }

    // Rotate: revoke the presented session before issuing a new one.
    await this.prisma.refreshTokenSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken } = await this.issueTokenPair(user.id, user.roles, metadata);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        roles: user.roles,
        permissions: user.permissions,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /** Revokes the single session tied to the presented refresh token. */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    await this.prisma.refreshTokenSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes every active session for the given user (all devices). */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshTokenSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    const currentValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!currentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);
    await this.usersService.updatePasswordHash(userId, newPasswordHash);

    // Force re-authentication everywhere after a password change.
    await this.logoutAll(userId);
  }

  /**
   * Simplified first-login password set: no current-password check
   * (the temporary password already got them a valid access token),
   * only usable while mustChangePassword is still true. Unlike
   * changePassword, this does NOT revoke the current session — the
   * user is mid-first-login and should be able to continue without
   * logging in again.
   */
  async setInitialPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    if (!user.mustChangePassword) {
      throw new ForbiddenException(
        'A password has already been set. Use change-password instead.',
      );
    }

    const newPasswordHash = await argon2.hash(newPassword);
    await this.usersService.updatePasswordHash(userId, newPasswordHash);
  }

  private async issueTokenPair(
    userId: string,
    roles: string[],
    metadata: RequestMetadata,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.tokenService.signAccessToken({ sub: userId, roles });
    const { token: refreshToken } = this.tokenService.signRefreshToken(userId);

    await this.prisma.refreshTokenSession.create({
      data: {
        userId,
        tokenHash: this.tokenService.hashToken(refreshToken),
        expiresAt: this.tokenService.getRefreshExpiryDate(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    return { accessToken, refreshToken };
  }
}
