import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OnboardingService } from './onboarding.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post('tenant')
  createTenant(@Body() dto: CreateTenantDto, @Req() req: Request) {
    return this.onboarding.createTenant(dto, req);
  }
}
