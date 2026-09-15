import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PermissionCodes } from '../rbac/permission-codes';
import { MmCompaniesService } from './mm-companies.service';

@ApiTags('mm-companies')
@Controller('mm-companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MmCompaniesController {
  constructor(private readonly companies: MmCompaniesService) {}

  @Get()
  @RequirePermissions(PermissionCodes.SurveyRead)
  @ApiOperation({
    summary:
      'Linked MM company for /premios (Company.id + tradeName; no establishments)',
  })
  list(@CurrentUser() user: AuthUser) {
    return this.companies.list(user.tenantId);
  }
}
