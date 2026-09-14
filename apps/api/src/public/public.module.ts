import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [RewardsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
