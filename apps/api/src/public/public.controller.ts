import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { PublicService } from './public.service';
import { SubmitResponseDto } from './dto/submit-response.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('caddy/ask')
  async caddyAsk(@Query('domain') domain?: string) {
    if (!domain) throw new ForbiddenException();
    const ok = await this.publicService.isAllowedDomain(domain);
    if (!ok) throw new ForbiddenException();
    return { ok: true };
  }

  @Get('surveys/:token')
  getSurvey(@Param('token') token: string) {
    return this.publicService.getPublishedSurvey(token);
  }

  @Get('surveys/:token/employees')
  listEmployees(@Param('token') token: string, @Query('q') q?: string) {
    return this.publicService.listSurveyEmployees(token, { q });
  }

  @Post('responses')
  submit(@Body() dto: SubmitResponseDto) {
    return this.publicService.submitResponse(dto);
  }
}
