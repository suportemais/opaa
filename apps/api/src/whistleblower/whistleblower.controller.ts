import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { WhistleblowerService } from './whistleblower.service';
import { UpdateWhistleblowerDto, CreateWhistleblowerEventDto } from './dto/update-whistleblower.dto';

@Controller('whistleblower')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WhistleblowerController {
  constructor(private readonly whistleblower: WhistleblowerService) {}

  @Get()
  @RequirePermissions(PermissionCodes.WhistleblowerRead)
  list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('unitId') unitId?: string,
    @Query('q') q?: string,
    @Query('identified') identified?: string,
  ) {
    return this.whistleblower.list(user, { cursor, take, status, priority, category, from, to, unitId, q, identified });
  }

  @Get(':id')
  @RequirePermissions(PermissionCodes.WhistleblowerRead)
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.whistleblower.detail(user, id);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCodes.WhistleblowerManage)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateWhistleblowerDto) {
    return this.whistleblower.update(user, id, dto);
  }

  @Post(':id/events')
  @RequirePermissions(PermissionCodes.WhistleblowerManage)
  addEvent(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateWhistleblowerEventDto) {
    return this.whistleblower.addEvent(user, id, dto);
  }
}
