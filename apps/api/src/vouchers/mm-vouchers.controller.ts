import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MmRewardVerifyResponseInterceptor } from '../rewards/mm-reward-verify-response.interceptor';
import { ConsumeAdhesionVoucherDto, ResolveAdhesionVoucherDto } from './dto/resolve-adhesion-voucher.dto';
import { MmAdhesionVouchersService } from './mm-adhesion-vouchers.service';
import { MmVoucherHmacGuard } from './mm-voucher-hmac.guard';
import { MmVoucherRateLimitGuard } from './mm-voucher-rate-limit.guard';

@ApiTags('internal-mm-vouchers')
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
  description: 'Legacy inbound timestamp header (same rules as X-MM-Timestamp).',
})
@ApiHeader({
  name: 'X-OPIINA-Signature',
  description: 'Legacy inbound signature header (same rules as X-MM-Signature).',
})
@Controller('internal/mm/vouchers')
@UseGuards(MmVoucherHmacGuard, MmVoucherRateLimitGuard)
@UseInterceptors(MmRewardVerifyResponseInterceptor)
export class MmVouchersController {
  constructor(private readonly vouchers: MmAdhesionVouchersService) {}

  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Muito Mais server-to-server adhesion voucher resolve (CNPJ + rules)',
  })
  resolve(@Body() dto: ResolveAdhesionVoucherDto) {
    return this.vouchers.resolve(dto);
  }

  @Post('consume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Muito Mais server-to-server mark adhesion voucher used (1×)',
  })
  consume(@Body() dto: ConsumeAdhesionVoucherDto) {
    return this.vouchers.consume(dto);
  }
}
