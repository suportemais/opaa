import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PermissionCodes } from '../rbac/permission-codes';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { FeedbacksService } from './feedbacks.service';
import { UpdateCaseDto } from './dto/update-case.dto';
import { CreateCaseInteractionDto } from './dto/create-case-interaction.dto';

@Controller('feedbacks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeedbacksController {
  constructor(private readonly feedbacks: FeedbacksService) {}

  @Get()
  @RequirePermissions(PermissionCodes.ResponseRead)
  list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
    @Query('case') caseFilter?: string,
    @Query('assignee') assignee?: string,
    @Query('due') due?: string,
    @Query('npsClass') npsClass?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.feedbacks.list(user, {
      cursor,
      take: take ? Number(take) : undefined,
      caseFilter,
      assignee,
      due,
      npsClass,
      from,
      to,
      unitId,
    });
  }

  @Get('kanban')
  @RequirePermissions(PermissionCodes.ResponseRead)
  kanban(
    @CurrentUser() user: AuthUser,
    @Query('case') caseFilter?: string,
    @Query('assignee') assignee?: string,
    @Query('due') due?: string,
  ) {
    return this.feedbacks.kanban(user, { caseFilter, assignee, due });
  }

  @Get(':id')
  @RequirePermissions(PermissionCodes.ResponseRead)
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.feedbacks.detail(user, id);
  }

  @Post(':id/case')
  @RequirePermissions(PermissionCodes.FeedbackManage)
  createCase(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.feedbacks.createCase(user, id);
  }

  @Patch(':id/case')
  @RequirePermissions(PermissionCodes.FeedbackManage)
  updateCase(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCaseDto) {
    return this.feedbacks.updateCase(user, id, dto);
  }

  @Post(':id/case/assign-me')
  @RequirePermissions(PermissionCodes.FeedbackManage)
  assignMe(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.feedbacks.assignMe(user, id);
  }

  @Get(':id/case/interactions')
  @RequirePermissions(PermissionCodes.ResponseRead)
  listCaseInteractions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.feedbacks.listCaseInteractions(user, id);
  }

  @Post(':id/case/interactions')
  @RequirePermissions(PermissionCodes.FeedbackManage)
  createCaseInteraction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateCaseInteractionDto) {
    return this.feedbacks.createCaseInteraction(user, id, dto);
  }
}
