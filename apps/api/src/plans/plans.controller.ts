import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PermissionCodes } from '../rbac/permission-codes';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  listPublic() {
    return this.plans.listPublic();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PermissionCodes.PlatformTenantManage)
  listAdmin() {
    return this.plans.listAdmin();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PermissionCodes.PlatformTenantManage)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.update(id, dto);
  }
}
