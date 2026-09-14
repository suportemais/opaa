import { Module } from '@nestjs/common';
import { RewardEmitService } from './reward-emit.service';
import { RewardVerifyService } from './reward-verify.service';
import { RewardRedeemService } from './reward-redeem.service';
import { MmRewardsController } from './mm-rewards.controller';
import { MmCompaniesController } from './mm-companies.controller';
import { MmCompaniesService } from './mm-companies.service';
import { MmRewardHmacGuard } from './mm-reward-hmac.guard';
import { MmRewardVerifyResponseInterceptor } from './mm-reward-verify-response.interceptor';
import { CouponCampaignsController } from './coupon-campaigns.controller';
import { CouponCampaignsService } from './coupon-campaigns.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [
    MmRewardsController,
    MmCompaniesController,
    CouponCampaignsController,
  ],
  providers: [
    RewardEmitService,
    RewardVerifyService,
    RewardRedeemService,
    MmCompaniesService,
    MmRewardHmacGuard,
    MmRewardVerifyResponseInterceptor,
    CouponCampaignsService,
  ],
  exports: [RewardEmitService, CouponCampaignsService],
})
export class RewardsModule {}
