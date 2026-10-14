import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PermissionCodes } from '../rbac/permission-codes';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { AllowBillingBlocked } from './allow-billing-blocked.decorator';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { SyncCheckoutDto } from './dto/sync-checkout.dto';
import { StripeErrorFilter } from './stripe-error.filter';

@Controller('billing')
@AllowBillingBlocked()
@UseFilters(StripeErrorFilter)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PermissionCodes.UnitRead)
  me(@CurrentUser() user: AuthUser) {
    return this.billing.summary(user.tenantId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto, @Req() req: Request) {
    return this.billing.createCheckoutSession(user, dto.planSlug, req);
  }

  @Post('checkout/sync')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  syncCheckout(@CurrentUser() user: AuthUser, @Body() dto: SyncCheckoutDto) {
    return this.billing.syncCheckoutSession(user, dto.sessionId);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PermissionCodes.TenantSettingsManage)
  portal(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.billing.createPortalSession(user, req);
  }

  /** Endpoint público chamado pela Stripe; autenticado pela assinatura HMAC. */
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.billing.handleWebhook(req.rawBody, signature);
  }
}
