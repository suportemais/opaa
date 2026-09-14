import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MmRewardHmacGuard } from './mm-reward-hmac.guard';
import { RewardVerifyService } from './reward-verify.service';
import { VerifyRewardDto } from './dto/verify-reward.dto';

@ApiTags('internal-mm-rewards')
@ApiHeader({
  name: 'X-OPIINA-Timestamp',
  description: 'Unix seconds (or ms) when the request was signed',
})
@ApiHeader({
  name: 'X-OPIINA-Signature',
  description:
    'hex HMAC-SHA256 of `${timestamp}.${canonicalJson({code, mmCompanyId?})}`',
})
@Controller('internal/mm/rewards')
@UseGuards(MmRewardHmacGuard)
export class MmRewardsController {
  constructor(private readonly verifyService: RewardVerifyService) {}

  @Post('verify')
  @ApiOperation({
    summary: 'Muito Mais server-to-server reward code verification',
  })
  verifyPost(@Body() dto: VerifyRewardDto) {
    return this.verifyService.verify(dto);
  }

  @Get('verify')
  @ApiOperation({
    summary: 'Muito Mais server-to-server reward code verification (GET)',
  })
  verifyGet(@Query() dto: VerifyRewardDto) {
    return this.verifyService.verify(dto);
  }
}
