import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PermissionCodes } from '../rbac/permission-codes';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Controller('tenant')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get('me')
  @RequirePermissions(PermissionCodes.UnitRead)
  me(@CurrentUser() user: AuthUser) {
    return this.tenants.me(user);
  }

  @Patch('me')
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(user, dto);
  }
}

