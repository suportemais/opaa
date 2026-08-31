import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PermissionCodes } from '../rbac/permission-codes';
import { MetricsService } from './metrics.service';
import { NpsQueryDto } from './dto/nps-query.dto';
import { CasesQueryDto } from './dto/cases-query.dto';
import { ReviewsQueryDto } from './dto/reviews-query.dto';
import { SentimentBackfillDto } from './dto/sentiment-backfill.dto';

@Controller('metrics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('nps/summary')
  @RequirePermissions(PermissionCodes.ResponseRead)
  npsSummary(@CurrentUser() user: AuthUser, @Query() query: NpsQueryDto) {
    return this.metrics.npsSummary(user, query);
  }

  @Get('nps/by-day')
  @RequirePermissions(PermissionCodes.ResponseRead)
  npsByDay(@CurrentUser() user: AuthUser, @Query() query: NpsQueryDto) {
    return this.metrics.npsByDay(user, query);
  }

  @Get('nps/by-unit')
  @RequirePermissions(PermissionCodes.ResponseRead)
  npsByUnit(@CurrentUser() user: AuthUser, @Query() query: NpsQueryDto) {
    return this.metrics.npsByUnit(user, query);
  }

  @Get('cases/summary')
  @RequirePermissions(PermissionCodes.ResponseRead)
  casesSummary(@CurrentUser() user: AuthUser, @Query() query: CasesQueryDto) {
    return this.metrics.casesSummary(user, query);
  }

  // ============ REVIEWS - Plataformas Externas ============
  @Get('reviews/platform-cards')
  @RequirePermissions(PermissionCodes.ReviewRead)
  reviewsPlatformCards(@CurrentUser() user: AuthUser, @Query() query: ReviewsQueryDto) {
    return this.metrics.reviewsPlatformCards(user, query);
  }

  @Get('reviews/by-unit')
  @RequirePermissions(PermissionCodes.ReviewRead)
  reviewsByUnit(@CurrentUser() user: AuthUser, @Query() query: ReviewsQueryDto) {
    return this.metrics.reviewsByUnit(user, query);
  }

  @Get('reviews/feed')
  @RequirePermissions(PermissionCodes.ReviewRead)
  reviewsFeed(@CurrentUser() user: AuthUser, @Query() query: ReviewsQueryDto) {
    return this.metrics.reviewsFeed(user, query);
  }

  @Get('sentiment/summary')
  @RequirePermissions(PermissionCodes.ResponseRead)
  sentimentSummary(@CurrentUser() user: AuthUser, @Query() query: NpsQueryDto) {
    return this.metrics.sentimentSummary(user, query);
  }

  @Post('sentiment/backfill')
  @RequirePermissions(PermissionCodes.ResponseRead)
  sentimentBackfill(@CurrentUser() user: AuthUser, @Body() dto: SentimentBackfillDto = {}) {
    return this.metrics.sentimentBackfill(user, dto ?? {});
  }
}
