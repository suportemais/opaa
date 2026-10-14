import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { BillingAccessInterceptor } from './billing-access.interceptor';

@Module({
  imports: [AuditModule],
  controllers: [BillingController],
  providers: [
    StripeService,
    BillingService,
    { provide: APP_INTERCEPTOR, useClass: BillingAccessInterceptor },
  ],
  exports: [StripeService, BillingService],
})
export class BillingModule {}
