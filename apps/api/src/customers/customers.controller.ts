import {
  BadRequestException,
  Body,
  Controller,
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

  @Post('import')
  @RequirePermissions(PermissionCodes.CustomerManage)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { files: 1, fileSize: 2 * 1024 * 1024 },
    }),
  )
  async import(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('missing_file');
    }
    const rawText = file.buffer.toString('utf-8');
    if (!rawText.trim()) throw new BadRequestException('empty_file');

    let rows: Array<Record<string, string>>;
    try {
      rows = parse(rawText, {
        columns: (header: Array<string>) =>
          header.map((h) => (typeof h === 'string' ? h.trim() : h)),
        skip_empty_lines: true,
        trim: true,
        bom: true,
        delimiter: [',', ';', '\t'],
        relax_column_count: true,
      });
    } catch {
      throw new BadRequestException('invalid_csv');
    }

    return this.customers.importFromCsv(user, rows);
  }

  @Get(':id')
  @RequirePermissions(PermissionCodes.CustomerRead)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.get(user, id);
  }

  @Get(':id/responses')
  @RequirePermissions(
    PermissionCodes.CustomerRead,
    PermissionCodes.ResponseRead,
  )
  responses(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.customers.listResponses(user, id);
  }

  @Get(':id/cases')
  @RequirePermissions(
    PermissionCodes.CustomerRead,
    PermissionCodes.ResponseRead,
  )
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
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user, id, dto);
  }
}
