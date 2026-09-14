import { Module } from '@nestjs/common';
import { RewardEmitService } from './reward-emit.service';
import { RewardVerifyService } from './reward-verify.service';
import { MmRewardsController } from './mm-rewards.controller';
import { MmRewardHmacGuard } from './mm-reward-hmac.guard';
import { MmRewardVerifyResponseInterceptor } from './mm-reward-verify-response.interceptor';
import { CouponCampaignsController } from './coupon-campaigns.controller';
import { CouponCampaignsService } from './coupon-campaigns.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [MmRewardsController, CouponCampaignsController],
  providers: [
    RewardEmitService,
    RewardVerifyService,
    MmRewardHmacGuard,
    MmRewardVerifyResponseInterceptor,
    CouponCampaignsService,
  ],
  exports: [RewardEmitService, CouponCampaignsService],
})
export class RewardsModule {}
