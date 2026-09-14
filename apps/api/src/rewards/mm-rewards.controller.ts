import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MmRewardHmacGuard } from './mm-reward-hmac.guard';
import { MmRewardVerifyResponseInterceptor } from './mm-reward-verify-response.interceptor';
import { RewardVerifyService } from './reward-verify.service';
import { VerifyRewardDto } from './dto/verify-reward.dto';

@ApiTags('internal-mm-rewards')
@ApiHeader({
  name: 'X-MM-Timestamp',
  description:
    'Unix seconds (or ms) when MM signed the request. Preferred inbound header.',
})
@ApiHeader({
  name: 'X-MM-Signature',
  description:
    '`sha256=<hex>` HMAC-SHA256 of `${timestamp}.${rawBody}` (also accepts bare hex).',
})
@ApiHeader({
  name: 'X-OPIINA-Timestamp',
  description:
    'Legacy inbound timestamp header (same rules as X-MM-Timestamp).',
})
@ApiHeader({
  name: 'X-OPIINA-Signature',
  description:
    'Legacy inbound signature header (same rules as X-MM-Signature).',
})
@Controller('internal/mm/rewards')
@UseGuards(MmRewardHmacGuard)
@UseInterceptors(MmRewardVerifyResponseInterceptor)
export class MmRewardsController {
  constructor(private readonly verifyService: RewardVerifyService) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
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
