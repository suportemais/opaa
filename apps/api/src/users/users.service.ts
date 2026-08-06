import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail } from '../common/normalize';
import type { AuthUser } from '../auth/auth.types';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(email: string) {
    return normalizeEmail(email);
  }

  findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        unitAccess: true,
      },
    });
  }

  findByEmailInTenant(tenantId: string, email: string) {
    const emailNormalized = normalizeEmail(email);
    return this.prisma.user.findUnique({
      where: { tenantId_emailNormalized: { tenantId, emailNormalized } },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        unitAccess: true,
      },
    });
  }

  findManyByEmail(email: string) {
    const emailNormalized = normalizeEmail(email);
    return this.prisma.user.findMany({
      where: { emailNormalized },
      include: {
        tenant: { select: { id: true, slug: true, tradeName: true, legalName: true } },
      },
    });
  }

  async listInTenant(user: AuthUser) {
    const users = await this.prisma.user.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        roles: { include: { role: true } },
        unitAccess: { include: { unit: { select: { id: true, name: true } } } },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      status: u.status,
      createdAt: u.createdAt,
      roles: u.roles.map((r) => ({ code: r.role.code, name: r.role.name })),
      unitAccess: u.unitAccess.map((ua) => ua.unit),
    }));
  }

  async createInTenant(user: AuthUser, dto: CreateUserDto) {
    const role = await this.prisma.role.findUnique({
      where: { tenantId_code: { tenantId: user.tenantId, code: dto.roleCode } },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('role_not_found');

    const hasUnitManage = role.permissions.some((p) => p.permission.code === 'unit:manage');
    if (!hasUnitManage && (!dto.unitIds || dto.unitIds.length === 0)) {
      throw new BadRequestException('unit_required');
    }

    if (dto.unitIds?.length) {
      const count = await this.prisma.unit.count({ where: { tenantId: user.tenantId, id: { in: dto.unitIds } } });
      if (count !== dto.unitIds.length) throw new BadRequestException('invalid_unit');
    }

    const passwordHash = await argon2.hash(dto.password);
    const emailNormalized = normalizeEmail(dto.email);
    const phoneNormalized = dto.phone ? dto.phone.replace(/\D+/g, '').slice(0, 30) || null : null;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            tenantId: user.tenantId,
            email: dto.email,
            emailNormalized,
            name: dto.name,
            phone: phoneNormalized,
            passwordHash,
            status: 'active',
          },
        });

        await tx.userRole.create({ data: { userId: u.id, roleId: role.id } });

        if (dto.unitIds?.length) {
          await tx.userUnitAccess.createMany({
            data: dto.unitIds.map((unitId) => ({ userId: u.id, unitId })),
          });
        }

        return u;
      });

      return { id: created.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('email_taken');
      }
      throw e;
    }
  }

  async updateInTenant(user: AuthUser, userId: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, tenantId: true } });
    if (!target || target.tenantId !== user.tenantId) throw new NotFoundException();

    const emailNormalized = dto.email ? normalizeEmail(dto.email) : undefined;
    const phoneNormalized =
      Object.prototype.hasOwnProperty.call(dto, 'phone')
        ? (dto.phone ?? '').replace(/\D+/g, '').slice(0, 30) || null
        : undefined;

    let roleId: string | null = null;
    let hasUnitManage = false;
    if (dto.roleCode) {
      const role = await this.prisma.role.findUnique({
        where: { tenantId_code: { tenantId: user.tenantId, code: dto.roleCode } },
        include: { permissions: { include: { permission: true } } },
      });
      if (!role) throw new NotFoundException('role_not_found');
      roleId = role.id;
      hasUnitManage = role.permissions.some((p) => p.permission.code === 'unit:manage');
    }

    if (!hasUnitManage && dto.unitIds && dto.unitIds.length === 0) {
      throw new BadRequestException('unit_required');
    }

    if (dto.unitIds?.length) {
      const count = await this.prisma.unit.count({ where: { tenantId: user.tenantId, id: { in: dto.unitIds } } });
      if (count !== dto.unitIds.length) throw new BadRequestException('invalid_unit');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            email: dto.email,
            emailNormalized,
            name: dto.name,
            phone: phoneNormalized,
            status: dto.status as any,
          },
        });

        if (roleId) {
          await tx.userRole.deleteMany({ where: { userId } });
          await tx.userRole.create({ data: { userId, roleId } });
        }

        if (dto.unitIds) {
          await tx.userUnitAccess.deleteMany({ where: { userId } });
          if (dto.unitIds.length) {
            await tx.userUnitAccess.createMany({
              data: dto.unitIds.map((unitId) => ({ userId, unitId })),
            });
          }
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('email_taken');
      }
      throw e;
    }

    return { ok: true };
  }

  async setPasswordInTenant(user: AuthUser, userId: string, password: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, tenantId: true } });
    if (!target || target.tenantId !== user.tenantId) throw new NotFoundException();

    const passwordHash = await argon2.hash(password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, refreshTokenHash: null },
    });
    return { ok: true };
  }

  async disableInTenant(user: AuthUser, userId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, tenantId: true } });
    if (!target || target.tenantId !== user.tenantId) throw new NotFoundException();

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'disabled', refreshTokenHash: null },
    });
    return { ok: true };
  }
}
