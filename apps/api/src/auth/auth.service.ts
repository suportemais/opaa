import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from '../common/crypto';
import { AuditService } from '../audit/audit.service';
import type { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private accessExpiresInSeconds() {
    return 60 * 15;
  }

  private refreshExpiresInSeconds() {
    return 60 * 60 * 24 * 30;
  }

  private async issueTokens(params: { userId: string; tenantId: string }) {
    const accessToken = await this.jwt.signAsync(
      { sub: params.userId, tid: params.tenantId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.accessExpiresInSeconds(),
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: params.userId, tid: params.tenantId, typ: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.refreshExpiresInSeconds(),
      },
    );

    await this.prisma.user.update({
      where: { id: params.userId },
      data: { refreshTokenHash: sha256(refreshToken) },
    });

    return { accessToken, refreshToken };
  }

  async login(params: { tenantId: string; email: string; password: string; req?: Request }) {
    const user = await this.users.findByEmailInTenant(params.tenantId, params.email);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException();
    }

    const ok = await argon2.verify(user.passwordHash, params.password);
    if (!ok) {
      await this.audit.log({
        tenantId: user.tenantId,
        actorType: 'system',
        action: 'auth.login_failed',
        entity: 'User',
        entityId: user.id,
        req: params.req,
      });
      throw new UnauthorizedException();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.id,
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      req: params.req,
    });

    const tokens = await this.issueTokens({ userId: user.id, tenantId: user.tenantId });
    return { userId: user.id, tenantId: user.tenantId, ...tokens };
  }

  async refresh(params: { refreshToken: string; req?: Request }) {
    const secret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const payload = await this.jwt.verifyAsync<{ sub: string; tid: string; typ?: string }>(
      params.refreshToken,
      { secret },
    );

    if (payload.typ !== 'refresh') {
      throw new ForbiddenException();
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.tenantId !== payload.tid || user.status !== 'active') {
      throw new ForbiddenException();
    }

    if (!user.refreshTokenHash || user.refreshTokenHash !== sha256(params.refreshToken)) {
      throw new ForbiddenException();
    }

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.id,
      action: 'auth.refresh',
      entity: 'User',
      entityId: user.id,
      req: params.req,
    });

    const tokens = await this.issueTokens({ userId: user.id, tenantId: user.tenantId });
    return { userId: user.id, tenantId: user.tenantId, ...tokens };
  }

  async logout(params: { userId: string; req?: Request }) {
    await this.prisma.user.update({
      where: { id: params.userId },
      data: { refreshTokenHash: null },
    });

    await this.audit.log({
      actorType: 'user',
      actorUserId: params.userId,
      action: 'auth.logout',
      entity: 'User',
      entityId: params.userId,
      req: params.req,
    });
  }
}
