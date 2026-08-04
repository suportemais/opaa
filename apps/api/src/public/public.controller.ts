import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PublicService } from './public.service';
import { SubmitResponseDto } from './dto/submit-response.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('surveys/:token')
  getSurvey(@Param('token') token: string) {
    return this.publicService.getPublishedSurvey(token);
  }

  @Post('responses')
  submit(@Body() dto: SubmitResponseDto) {
    return this.publicService.submitResponse(dto);
  }
}
