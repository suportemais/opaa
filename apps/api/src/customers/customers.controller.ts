import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PermissionCodes } from '../rbac/permission-codes';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerInteractionDto } from './dto/create-customer-interaction.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(PermissionCodes.CustomerRead)
  list(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.customers.list(user, q);
  }

  @Get(':id')
  @RequirePermissions(PermissionCodes.CustomerRead)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.get(user, id);
  }

  @Get(':id/responses')
  @RequirePermissions(PermissionCodes.CustomerRead, PermissionCodes.ResponseRead)
  responses(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.listResponses(user, id);
  }

  @Get(':id/cases')
  @RequirePermissions(PermissionCodes.CustomerRead, PermissionCodes.ResponseRead)
  cases(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.listCases(user, id);
  }

  @Get(':id/interactions')
  @RequirePermissions(PermissionCodes.CustomerRead)
  interactions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.listInteractions(user, id);
  }

  @Post(':id/interactions')
  @RequirePermissions(PermissionCodes.CustomerManage)
  createInteraction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateCustomerInteractionDto,
  ) {
    return this.customers.createInteraction(user, id, dto);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCodes.CustomerManage)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(user, id, dto);
  }
}
