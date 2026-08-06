import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { SurveysService } from './surveys.service';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { UpdateSurveyDto } from './dto/update-survey.dto';
import { CreateDistributionDto } from './dto/create-distribution.dto';

@Controller('surveys')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SurveysController {
  constructor(private readonly surveys: SurveysService) {}

  @Get()
  @RequirePermissions(PermissionCodes.SurveyRead)
  list(@CurrentUser() user: AuthUser) {
    return this.surveys.list(user);
  }

  @Get(':id')
  @RequirePermissions(PermissionCodes.SurveyRead)
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.surveys.getById(user, id);
  }

  @Get(':id/distributions')
  @RequirePermissions(PermissionCodes.SurveyRead)
  listDistributions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.surveys.listDistributions(user, id);
  }

  @Post()
  @RequirePermissions(PermissionCodes.SurveyManage)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSurveyDto, @Req() req: Request) {
    return this.surveys.create(user, dto, req);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCodes.SurveyManage)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSurveyDto, @Req() req: Request) {
    return this.surveys.update(user, id, dto, req);
  }

  @Post('distributions')
  @RequirePermissions(PermissionCodes.SurveyManage)
  createDistribution(@CurrentUser() user: AuthUser, @Body() dto: CreateDistributionDto) {
    return this.surveys.createDistribution(user, dto);
  }

  @Post(':id/publish')
  @RequirePermissions(PermissionCodes.SurveyManage)
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.surveys.publish(user, id, req);
  }

  @Delete(':id')
  @RequirePermissions(PermissionCodes.SurveyManage)
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.surveys.archive(user, id, req);
  }
}
