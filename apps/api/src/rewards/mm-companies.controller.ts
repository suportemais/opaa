import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
      'MM companies for /premios (Company.id + tradeName; no establishments)',
  })
  list() {
    return this.companies.list();
  }
}
