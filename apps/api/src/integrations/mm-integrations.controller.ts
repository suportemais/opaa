import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PermissionCodes } from '../rbac/permission-codes';
import { ConnectMmDto } from './dto/connect-mm.dto';
import { MmIntegrationsService } from './mm-integrations.service';

@ApiTags('integrations')
@Controller('integrations/mm')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MmIntegrationsController {
  constructor(private readonly integrations: MmIntegrationsService) {}

  @Get()
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  @ApiOperation({
    summary: 'Muito Mais connection status (no secret)',
  })
  status(@CurrentUser() user: AuthUser) {
    return this.integrations.status(user);
  }

  @Post('connect')
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  @ApiOperation({
    summary: 'Validate MM API key and persist tenant ↔ mmCompanyId link',
  })
  connect(@CurrentUser() user: AuthUser, @Body() dto: ConnectMmDto) {
    return this.integrations.connect(user, dto.apiKey);
  }

  @Delete()
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  @ApiOperation({ summary: 'Disconnect Muito Mais (keeps campaigns)' })
  disconnect(@CurrentUser() user: AuthUser) {
    return this.integrations.disconnect(user);
  }
}
