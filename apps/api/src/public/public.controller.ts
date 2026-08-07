import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from '@nestjs/common';
import { PublicService } from './public.service';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { SubmitWhistleblowerDto } from './dto/submit-whistleblower.dto';
import type { Request } from 'express';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('caddy/ask')
  async caddyAsk(@Query('domain') domain?: string, @Req() req?: Request) {
    const fallback = req?.query?.domain;
    const finalDomain = typeof domain === 'string' && domain.trim() ? domain : typeof fallback === 'string' && fallback.trim() ? fallback : undefined;
    if (!finalDomain) throw new ForbiddenException();
    const ok = await this.publicService.isAllowedDomain(finalDomain);
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

  @Get('whistleblower/:tenantSlug')
  getWhistleblowerForm(@Param('tenantSlug') tenantSlug: string) {
    return this.publicService.getWhistleblowerForm(tenantSlug);
  }

  @Post('whistleblower/:tenantSlug')
  submitWhistleblower(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: SubmitWhistleblowerDto,
  ) {
    return this.publicService.submitWhistleblower(tenantSlug, dto);
  }
}
