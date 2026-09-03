import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PermissionCodes } from '../rbac/permission-codes';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PlansService } from '../plans/plans.service';
import { UpdatePlanDto } from '../plans/dto/update-plan.dto';
import { AccountsQueryDto } from './dto/accounts-query.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { ExtendTrialDto } from './dto/extend-trial.dto';
import { GrantAccessDto } from './dto/grant-access.dto';
import { OverviewQueryDto } from './dto/overview-query.dto';
import { PlatformService } from './platform.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly plans: PlansService,
  ) {}

  @Get('overview')
  @RequirePermissions(PermissionCodes.PlatformTenantRead)
  overview(@Query() query: OverviewQueryDto) {
    return this.platform.overview(query);
  }

  @Get('accounts')
  @RequirePermissions(PermissionCodes.PlatformTenantRead)
  listAccounts(@Query() query: AccountsQueryDto) {
    return this.platform.listAccounts(query);
  }

  @Get('accounts/:id')
  @RequirePermissions(PermissionCodes.PlatformTenantRead)
  getAccount(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.platform.getAccount(id);
  }

  @Post('accounts/:id/change-plan')
  @RequirePermissions(PermissionCodes.PlatformTenantManage)
  changePlan(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.platform.changePlan(user, id, dto);
  }

  @Post('accounts/:id/extend-trial')
  @RequirePermissions(PermissionCodes.PlatformTenantManage)
  extendTrial(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ExtendTrialDto,
  ) {
    return this.platform.extendTrial(user, id, dto);
  }

  @Post('accounts/:id/suspend')
  @RequirePermissions(PermissionCodes.PlatformTenantManage)
  suspend(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.platform.suspend(user, id);
  }

  @Post('accounts/:id/reactivate')
  @RequirePermissions(PermissionCodes.PlatformTenantManage)
  reactivate(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.platform.reactivate(user, id);
  }

  @Post('accounts/:id/grant-access')
  @RequirePermissions(PermissionCodes.PlatformTenantManage)
  grantAccess(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: GrantAccessDto,
  ) {
    return this.platform.grantAccess(user, id, dto);
  }

  @Get('plans')
  @RequirePermissions(PermissionCodes.PlatformTenantRead)
  listPlans() {
    return this.platform.listPlans();
  }

  @Patch('plans/:id')
  @RequirePermissions(PermissionCodes.PlatformTenantManage)
  updatePlan(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.update(id, dto);
  }

  @Get('subscriptions')
  @RequirePermissions(PermissionCodes.PlatformTenantRead)
  listSubscriptions() {
    return this.platform.listSubscriptions();
  }
}
