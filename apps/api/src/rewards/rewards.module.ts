import { Module } from '@nestjs/common';
import { RewardEmitService } from './reward-emit.service';
import { RewardVerifyService } from './reward-verify.service';
import { MmRewardsController } from './mm-rewards.controller';
import { MmRewardHmacGuard } from './mm-reward-hmac.guard';

@Module({
  controllers: [MmRewardsController],
  providers: [RewardEmitService, RewardVerifyService, MmRewardHmacGuard],
  exports: [RewardEmitService],
})
export class RewardsModule {}
