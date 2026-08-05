import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions(PermissionCodes.UnitRead)
  list(@CurrentUser() user: AuthUser, @Query('unitId') unitId?: string, @Query('q') q?: string, @Query('status') status?: string) {
    return this.employees.list(user, { unitId, q, status });
  }

  @Post()
  @RequirePermissions(PermissionCodes.UnitManage)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCodes.UnitManage)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PermissionCodes.UnitManage)
  disable(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employees.disable(user, id);
  }
}

