import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { MmRewardVerifyResponseInterceptor } from '../rewards/mm-reward-verify-response.interceptor';
import { MmAdhesionVouchersController } from './mm-adhesion-vouchers.controller';
import { MmAdhesionVouchersService } from './mm-adhesion-vouchers.service';
import { MmVoucherHmacGuard } from './mm-voucher-hmac.guard';
import { MmVoucherRateLimitGuard } from './mm-voucher-rate-limit.guard';
import { MmVouchersController } from './mm-vouchers.controller';

@Module({
  imports: [RbacModule],
  controllers: [MmAdhesionVouchersController, MmVouchersController],
  providers: [
    MmAdhesionVouchersService,
    MmVoucherHmacGuard,
    MmVoucherRateLimitGuard,
    MmRewardVerifyResponseInterceptor,
  ],
  exports: [MmAdhesionVouchersService],
})
export class VouchersModule {}
