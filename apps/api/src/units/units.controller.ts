import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PermissionCodes } from '../rbac/permission-codes';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import type { UpsertReviewProfileDto } from './dto/review-profile.dto';
import { ReviewPlatform } from '@prisma/client';

@Controller('units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  @RequirePermissions(PermissionCodes.UnitRead)
  list(@CurrentUser() user: AuthUser) {
    return this.units.list(user);
  }

  @Post()
  @RequirePermissions(PermissionCodes.UnitManage)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUnitDto) {
    return this.units.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCodes.UnitManage)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.units.update(user, id, dto);
  }

  @Get(':id/review-profiles')
  @RequirePermissions(PermissionCodes.ReviewRead)
  listReviewProfiles(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.units.listReviewProfiles(user, id);
  }

  @Put(':id/review-profiles')
  @RequirePermissions(PermissionCodes.ReviewManage)
  upsertReviewProfile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpsertReviewProfileDto,
  ) {
    return this.units.upsertReviewProfile(user, id, dto);
  }

  @Post(':id/review-profiles/:platform/sync-now')
  @RequirePermissions(PermissionCodes.ReviewManage)
  triggerSyncNow(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('platform') platform: ReviewPlatform,
  ) {
    return this.units.triggerSyncNow(user, id, platform);
  }
}
