import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PermissionCodes } from '../rbac/permission-codes';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetUserPasswordDto } from './dto/set-user-password.dto';
import { InviteUserDto } from './dto/invite-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PermissionCodes.UserManage)
  list(@CurrentUser() user: AuthUser) {
    return this.users.listInTenant(user);
  }

  /** Usuários ativos com `feedback:manage` — para o seletor de responsável dos casos. */
  @Get('assignable')
  @RequirePermissions(PermissionCodes.FeedbackManage)
  assignable(@CurrentUser() user: AuthUser) {
    return this.users.listAssignable(user);
  }

  @Post('invite')
  @RequirePermissions(PermissionCodes.UserManage)
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.users.inviteInTenant(user, dto);
  }

  @Post(':id/resend-invite')
  @RequirePermissions(PermissionCodes.UserManage)
  resendInvite(@CurrentUser() user: AuthUser, @Param('id') userId: string) {
    return this.users.resendInviteInTenant(user, userId);
  }

  @Post()
  @RequirePermissions(PermissionCodes.UserManage)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.createInTenant(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCodes.UserManage)
  update(@CurrentUser() user: AuthUser, @Param('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.users.updateInTenant(user, userId, dto);
  }

  @Post(':id/password')
  @RequirePermissions(PermissionCodes.UserManage)
  setPassword(@CurrentUser() user: AuthUser, @Param('id') userId: string, @Body() dto: SetUserPasswordDto) {
    return this.users.setPasswordInTenant(user, userId, dto.password);
  }

  @Delete(':id')
  @RequirePermissions(PermissionCodes.UserManage)
  disable(@CurrentUser() user: AuthUser, @Param('id') userId: string) {
    if (userId === user.userId) throw new BadRequestException('cannot_disable_self');
    return this.users.disableInTenant(user, userId);
  }
}
