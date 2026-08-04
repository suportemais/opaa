import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import type { CreateUnitDto } from './dto/create-unit.dto';
import type { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  create(user: AuthUser, dto: CreateUnitDto) {
    return this.prisma.unit.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        internalCode: dto.internalCode,
        timeZone: dto.timeZone,
        address: dto.address,
      },
    });
  }

  list(user: AuthUser) {
    const canSeeAll = user.permissionCodes.includes(PermissionCodes.UnitManage);
    return this.prisma.unit.findMany({
      where: {
        tenantId: user.tenantId,
        ...(canSeeAll ? {} : { id: { in: user.unitIds.length ? user.unitIds : ['__none__'] } }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateUnitDto) {
    const existing = await this.prisma.unit.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) throw new NotFoundException('unit_not_found');

    return this.prisma.unit.update({
      where: { id },
      data: {
        name: dto.name,
        internalCode: dto.internalCode,
        timeZone: dto.timeZone,
        address: dto.address,
      },
    });
  }
}
