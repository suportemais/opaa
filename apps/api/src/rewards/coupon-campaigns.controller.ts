import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PermissionCodes } from '../rbac/permission-codes';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { CouponCampaignsService } from './coupon-campaigns.service';
import { CreateCouponCampaignDto } from './dto/create-coupon-campaign.dto';
import { UpdateCouponCampaignDto } from './dto/update-coupon-campaign.dto';

@Controller('coupon-campaigns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CouponCampaignsController {
  constructor(private readonly campaigns: CouponCampaignsService) {}

  @Get()
  @RequirePermissions(PermissionCodes.SurveyRead)
  list(@CurrentUser() user: AuthUser) {
    return this.campaigns.list(user);
  }

  @Get(':id')
  @RequirePermissions(PermissionCodes.SurveyRead)
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaigns.getById(user, id);
  }

  @Post()
  @RequirePermissions(PermissionCodes.SurveyManage)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCouponCampaignDto) {
    return this.campaigns.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCodes.SurveyManage)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCouponCampaignDto) {
    return this.campaigns.update(user, id, dto);
  }

  @Post(':id/pause')
  @RequirePermissions(PermissionCodes.SurveyManage)
  pause(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaigns.pause(user, id);
  }

  @Post(':id/activate')
  @RequirePermissions(PermissionCodes.SurveyManage)
  activate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaigns.activate(user, id);
  }
}
