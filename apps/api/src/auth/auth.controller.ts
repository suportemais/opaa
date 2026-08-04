import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private cookieSettings() {
    const basePath = process.env.API_BASE_PATH ?? '';
    const normalizedBase = basePath ? `/${basePath.replace(/^\/+|\/+$/g, '')}` : '';
    const path = `${normalizedBase}/auth/refresh` || '/auth/refresh';

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
    await this.auth.logout({ userId: user.userId, req });
    res.clearCookie('rt', { path: '/auth/refresh' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }
}
