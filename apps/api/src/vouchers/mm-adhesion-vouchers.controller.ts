import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PermissionCodes } from '../rbac/permission-codes';
import { CreateAdhesionVoucherDto } from './dto/create-adhesion-voucher.dto';
import { MmAdhesionVouchersService } from './mm-adhesion-vouchers.service';

@ApiTags('mm-vouchers')
@Controller('mm-vouchers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MmAdhesionVouchersController {
  constructor(private readonly vouchers: MmAdhesionVouchersService) {}

  @Get()
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  @ApiOperation({ summary: 'List recent MM adhesion vouchers for this tenant' })
  list(@CurrentUser() user: AuthUser) {
    return this.vouchers.list(user);
  }

  @Post()
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  @ApiOperation({
    summary: 'Mint a one-time 7-digit MM adhesion voucher (unit CNPJ)',
  })
  mint(@CurrentUser() user: AuthUser, @Body() dto: CreateAdhesionVoucherDto) {
    return this.vouchers.mint(user, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  @ApiOperation({ summary: 'Cancel an unused adhesion voucher' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vouchers.cancel(user, id);
  }
}
