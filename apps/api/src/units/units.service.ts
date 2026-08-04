import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import type { CreateUnitDto } from './dto/create-unit.dto';
import type { UpdateUnitDto } from './dto/update-unit.dto';
import { googleBusinessUrlFromSettings, withGoogleBusinessUrl } from '../common/unit-settings';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  private toOutput(u: { settings: unknown } & Record<string, any>) {
    const { settings, ...rest } = u as any;
    return {
      ...rest,
      googleBusinessUrl: googleBusinessUrlFromSettings(settings),
    };
  }

  async create(user: AuthUser, dto: CreateUnitDto) {
    const settings = dto.googleBusinessUrl ? withGoogleBusinessUrl(null, dto.googleBusinessUrl) : undefined;
    const created = await this.prisma.unit.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        internalCode: dto.internalCode,
        timeZone: dto.timeZone,
        address: dto.address,
        settings: settings as any,
      },
    });
    return this.toOutput(created as any);
  }

  async list(user: AuthUser) {
    const canSeeAll = user.permissionCodes.includes(PermissionCodes.UnitManage);
    const rows = await this.prisma.unit.findMany({
      where: {
        tenantId: user.tenantId,
        ...(canSeeAll ? {} : { id: { in: user.unitIds.length ? user.unitIds : ['__none__'] } }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((u) => this.toOutput(u as any));
  }

  async update(user: AuthUser, id: string, dto: UpdateUnitDto) {
    const existing = await this.prisma.unit.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) throw new NotFoundException('unit_not_found');

    const nextSettings =
      dto.googleBusinessUrl !== undefined ? withGoogleBusinessUrl(existing.settings, dto.googleBusinessUrl) : existing.settings;

    const updated = await this.prisma.unit.update({
      where: { id },
      data: {
        name: dto.name,
        internalCode: dto.internalCode,
        timeZone: dto.timeZone,
        address: dto.address,
        settings: nextSettings as any,
      },
    });
    return this.toOutput(updated as any);
  }
}
