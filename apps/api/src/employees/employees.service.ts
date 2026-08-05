import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  private unitWhere(user: AuthUser) {
    const canSeeAll = user.permissionCodes.includes(PermissionCodes.UnitManage);
    if (canSeeAll) return {};
    const allowed = user.unitIds.length ? user.unitIds : ['__none__'];
    return { unitId: { in: allowed } };
  }

  async list(user: AuthUser, params: { unitId?: string; q?: string; status?: string }) {
    if (params.unitId && !user.permissionCodes.includes(PermissionCodes.UnitManage)) {
      if (!user.unitIds.includes(params.unitId)) throw new ForbiddenException();
    }

    const q = typeof params.q === 'string' && params.q.trim() ? params.q.trim() : undefined;
    const status = params.status === 'active' || params.status === 'inactive' ? params.status : undefined;

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId: user.tenantId,
        ...(params.unitId ? { unitId: params.unitId } : this.unitWhere(user)),
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        unitId: true,
        name: true,
        code: true,
        roleTitle: true,
        status: true,
        createdAt: true,
        unit: { select: { id: true, name: true } },
      },
    });

    return employees;
  }

  async create(user: AuthUser, dto: CreateEmployeeDto) {
    const unit = await this.prisma.unit.findFirst({ where: { id: dto.unitId, tenantId: user.tenantId }, select: { id: true } });
    if (!unit) throw new NotFoundException('unit_not_found');

    const code = typeof dto.code === 'string' && dto.code.trim() ? dto.code.trim() : null;

    try {
      const created = await this.prisma.employee.create({
        data: {
          tenantId: user.tenantId,
          unitId: dto.unitId,
          name: dto.name.trim(),
          code,
          roleTitle: typeof dto.roleTitle === 'string' && dto.roleTitle.trim() ? dto.roleTitle.trim() : null,
          status: 'active',
        },
        select: { id: true },
      });
      return created;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('employee_code_taken');
      }
      throw e;
    }
  }

  async update(user: AuthUser, employeeId: string, dto: UpdateEmployeeDto) {
    const current = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId: user.tenantId },
      select: { id: true, unitId: true },
    });
    if (!current) throw new NotFoundException();

    if (dto.unitId) {
      const unit = await this.prisma.unit.findFirst({ where: { id: dto.unitId, tenantId: user.tenantId }, select: { id: true } });
      if (!unit) throw new NotFoundException('unit_not_found');
    }

    const name = typeof dto.name === 'string' ? dto.name.trim() : undefined;
    if (name !== undefined && !name) throw new BadRequestException('invalid_name');

    const code =
      dto.code === undefined ? undefined : typeof dto.code === 'string' && dto.code.trim() ? dto.code.trim() : null;

    const roleTitle =
      dto.roleTitle === undefined
        ? undefined
        : typeof dto.roleTitle === 'string' && dto.roleTitle.trim()
          ? dto.roleTitle.trim()
          : null;

    try {
      await this.prisma.employee.update({
        where: { id: current.id },
        data: {
          unitId: dto.unitId,
          name,
          code,
          roleTitle,
          status: dto.status,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('employee_code_taken');
      }
      throw e;
    }

    return { ok: true };
  }

  async disable(user: AuthUser, employeeId: string) {
    const current = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!current) throw new NotFoundException();

    await this.prisma.employee.update({ where: { id: current.id }, data: { status: 'inactive' } });
    return { ok: true };
  }
}

