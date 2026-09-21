import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
    return roles.map((role) => this.toRoleResponse(role));
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('A role with this name already exists');
    }

    const permissionIds = await this.resolvePermissionIds(dto.permissions ?? []);

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        rolePermissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: { rolePermissions: { include: { permission: true } } },
    });

    return this.toRoleResponse(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    const data: { description?: string } = {};
    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    if (dto.permissions) {
      const permissionIds = await this.resolvePermissionIds(dto.permissions);
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      });
    }

    const role = await this.prisma.role.update({
      where: { id },
      data,
      include: { rolePermissions: { include: { permission: true } } },
    });

    return this.toRoleResponse(role);
  }

  private async resolvePermissionIds(permissionNames: string[]): Promise<string[]> {
    if (permissionNames.length === 0) {
      return [];
    }

    const permissions = await this.prisma.permission.findMany({
      where: { name: { in: permissionNames } },
    });

    const found = new Set(permissions.map((permission) => permission.name));
    const missing = permissionNames.filter((name) => !found.has(name));
    if (missing.length > 0) {
      throw new NotFoundException(`Unknown permission(s): ${missing.join(', ')}`);
    }

    return permissions.map((permission) => permission.id);
  }

  private toRoleResponse(role: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    rolePermissions: { permission: { name: string } }[];
  }) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.rolePermissions.map((rp) => rp.permission.name),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
