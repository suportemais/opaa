import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewPlatform, SyncFrequency, SyncStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import type { CreateUnitDto } from './dto/create-unit.dto';
import type { UpdateUnitDto } from './dto/update-unit.dto';
import type { UpsertReviewProfileDto } from './dto/review-profile.dto';
import { googleBusinessUrlFromSettings, withGoogleBusinessUrl } from '../common/unit-settings';
import { ReviewSyncService } from '../review-sync/review-sync.service';

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewSync: ReviewSyncService,
  ) {}

  private toOutput(u: { settings: unknown } & Record<string, any>) {
    const { settings, ...rest } = u as any;
    return {
      ...rest,
      googleBusinessUrl: googleBusinessUrlFromSettings(settings),
    };
  }

  private canManage(user: AuthUser) {
    return user.permissionCodes.includes(PermissionCodes.UnitManage);
  }

  private canReviewManage(user: AuthUser) {
    return user.permissionCodes.includes(PermissionCodes.ReviewManage);
  }

  private canReviewRead(user: AuthUser) {
    return user.permissionCodes.includes(PermissionCodes.ReviewRead);
  }

  private async assertUnitAccess(user: AuthUser, unitId: string, requireManage = false) {
    if (requireManage && !this.canManage(user) && !this.canReviewManage(user)) {
      throw new ForbiddenException();
    }
    const canSeeAllUnits = this.canManage(user);
    if (!canSeeAllUnits && !user.unitIds.includes(unitId)) {
      throw new ForbiddenException();
    }
    const unit = await this.prisma.unit.findFirst({ where: { id: unitId, tenantId: user.tenantId } });
    if (!unit) throw new NotFoundException('unit_not_found');
    return unit;
  }

  private readonly DEFAULT_PLATFORMS: ReviewPlatform[] = ['google', 'ifood', 'tripadvisor', 'reclameaqui'];

  private defaultProfile(platform: ReviewPlatform, unitId: string, tenantId: string) {
    const defaults: Record<ReviewPlatform, { syncFrequency: SyncFrequency }> = {
      google: { syncFrequency: 'every6h' },
      ifood: { syncFrequency: 'hourly' },
      tripadvisor: { syncFrequency: 'daily' },
      reclameaqui: { syncFrequency: 'hourly' },
    };
    return {
      id: `pending-${platform}`,
      tenantId,
      unitId,
      platform,
      publicUrl: null,
      locationId: null,
      apiKeyEncrypted: null,
      syncFrequency: defaults[platform].syncFrequency,
      syncStatus: 'idle' as SyncStatus,
      lastSyncAt: null,
      lastError: null,
      lastRating: null,
      lastReviewCount: null,
      lastPositiveCount: null,
      lastNeutralCount: null,
      lastNegativeCount: null,
      createdAt: null,
      updatedAt: null,
      isPlaceholder: true,
    };
  }

  async create(user: AuthUser, dto: CreateUnitDto) {
    if (!this.canManage(user)) throw new ForbiddenException();
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
    const canSeeAll = this.canManage(user);
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
    if (!this.canManage(user)) throw new ForbiddenException();
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

  async listReviewProfiles(user: AuthUser, unitId: string) {
    await this.assertUnitAccess(user, unitId, false);
    if (!this.canReviewRead(user) && !this.canManage(user)) {
      throw new ForbiddenException();
    }
    const existing = await this.prisma.reviewSyncProfile.findMany({
      where: { tenantId: user.tenantId, unitId },
      orderBy: { createdAt: 'asc' },
    });
    const existingMap = new Map(existing.map((p) => [p.platform, { ...p, isPlaceholder: false }]));
    return this.DEFAULT_PLATFORMS.map((p) =>
      existingMap.get(p) ?? this.defaultProfile(p, unitId, user.tenantId),
    );
  }

  async upsertReviewProfile(user: AuthUser, unitId: string, dto: UpsertReviewProfileDto) {
    await this.assertUnitAccess(user, unitId, true);
    if (!this.canReviewManage(user) && !this.canManage(user)) {
      throw new ForbiddenException();
    }
    const data = {
      tenantId: user.tenantId,
      unitId,
      platform: dto.platform,
      publicUrl: dto.publicUrl ?? null,
      locationId: dto.locationId ?? null,
      apiKeyEncrypted: dto.apiKeyEncrypted ?? null,
      syncFrequency: dto.syncFrequency ?? 'hourly',
      syncStatus: dto.syncStatus ?? 'idle',
    };
    const saved = await this.prisma.reviewSyncProfile.upsert({
      where: {
        tenantId_unitId_platform: {
          tenantId: user.tenantId,
          unitId,
          platform: dto.platform,
        },
      },
      create: data as any,
      update: {
        publicUrl: data.publicUrl,
        locationId: data.locationId,
        apiKeyEncrypted: data.apiKeyEncrypted,
        syncFrequency: data.syncFrequency,
        syncStatus: data.syncStatus,
      } as any,
    });
    return { ...saved, isPlaceholder: false };
  }

  async triggerSyncNow(user: AuthUser, unitId: string, platform: ReviewPlatform) {
    await this.assertUnitAccess(user, unitId, true);
    if (!this.canReviewManage(user) && !this.canManage(user)) {
      throw new ForbiddenException();
    }
    const result = await this.reviewSync.runSyncNow(user.tenantId, unitId, platform);
    return { ok: true, status: 'completed', ...result };
  }
}
