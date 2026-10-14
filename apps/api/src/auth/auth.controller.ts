import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth.types';
import { AllowBillingBlocked } from '../billing/allow-billing-blocked.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMeDto } from './dto/update-me.dto';

@Controller('auth')
@AllowBillingBlocked()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private cookieSettings() {
    const basePath = process.env.API_BASE_PATH ?? '';
    const normalizedBase = basePath ? `/${basePath.replace(/^\/+|\/+$/g, '')}` : '';
    const path = `${normalizedBase}/auth/refresh`;

    const secure =
      (process.env.COOKIE_SECURE ?? '').toLowerCase() === 'true' || (process.env.APP_BASE_URL ?? '').startsWith('https://');

    return { path, secure };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login({
      tenantId: dto.tenantId,
      email: dto.email,
      password: dto.password,
      req,
    });

    const cookie = this.cookieSettings();
    res.cookie('rt', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookie.secure,
      path: cookie.path,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    return { accessToken: result.accessToken, userId: result.userId, tenantId: result.tenantId };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.rt;
    if (typeof refreshToken !== 'string') return { accessToken: null };

    const result = await this.auth.refresh({ refreshToken, req });

    const cookie = this.cookieSettings();
    res.cookie('rt', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookie.secure,
      path: cookie.path,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    return { accessToken: result.accessToken, userId: result.userId, tenantId: result.tenantId };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookie = this.cookieSettings();
    await this.auth.logout({ userId: user.userId, req });
    res.clearCookie('rt', { path: cookie.path, secure: cookie.secure });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(user, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }

  @Post('forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto, req);
  }

  @Post('reset')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto, req);
  }

  @Post('accept-invite')
  acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: Request) {
    return this.auth.acceptInvite(dto, req);
  }
}
