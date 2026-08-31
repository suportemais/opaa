import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { parse } from 'csv-parse/sync';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionCodes } from '../rbac/permission-codes';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportEmployeesFormDto {
  @IsUUID('4')
  @IsNotEmpty()
  @Type(() => String)
  unitId!: string;
}

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions(PermissionCodes.EmployeeRead)
  list(@CurrentUser() user: AuthUser, @Query('unitId') unitId?: string, @Query('q') q?: string, @Query('status') status?: string) {
    return this.employees.list(user, { unitId, q, status });
  }

  @Post()
  @RequirePermissions(PermissionCodes.EmployeeManage)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user, dto);
  }

  @Post('import')
  @RequirePermissions(PermissionCodes.EmployeeManage)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { files: 1, fileSize: 2 * 1024 * 1024 },
    }),
  )
  async import(
    @CurrentUser() user: AuthUser,
    @Body() form: ImportEmployeesFormDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) throw new BadRequestException('missing_file');

    const unitId = typeof form?.unitId === 'string' && form.unitId.trim() ? form.unitId.trim() : undefined;
    if (!unitId) throw new BadRequestException('missing_unit');

    const rawText = file.buffer.toString('utf-8');
    if (!rawText.trim()) throw new BadRequestException('empty_file');

    let rows: Array<Record<string, string>>;
    try {
      rows = parse(rawText, {
        columns: (header: Array<string>) => header.map((h) => (typeof h === 'string' ? h.trim() : h)),
        skip_empty_lines: true,
        trim: true,
        bom: true,
        delimiter: [',', ';', '\t'],
        relax_column_count: true,
      }) as Array<Record<string, string>>;
    } catch {
      throw new BadRequestException('invalid_csv');
    }

    return this.employees.importFromCsv(user, { unitId, rows });
  }

  @Patch(':id')
  @RequirePermissions(PermissionCodes.EmployeeManage)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PermissionCodes.EmployeeManage)
  disable(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employees.disable(user, id);
  }
}

