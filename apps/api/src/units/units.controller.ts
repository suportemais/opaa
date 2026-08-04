import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PermissionCodes } from '../rbac/permission-codes';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

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
}
