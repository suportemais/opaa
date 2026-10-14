import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

/** Erro claro para login de usuário com convite ainda não aceito. */
export function invitePendingError() {
  return new UnauthorizedException({
    statusCode: 401,
    code: 'user_invited',
    message: 'Convite pendente: abra o link enviado por e-mail para criar sua senha e ativar o acesso.',
  });
}
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from '../common/crypto';
import { AuditService } from '../audit/audit.service';
import { baseDomain, requestHost, tenantSlugFromHost } from '../common/tenant-host';
import type { Request } from 'express';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { AcceptInviteDto } from './dto/accept-invite.dto';
import type { UpdateMeDto } from './dto/update-me.dto';
import { normalizeEmail } from '../common/normalize';
import { randomBytes } from 'node:crypto';
import { MailerService } from '../mailer/mailer.module';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
  ) {}

  private accessExpiresInSeconds() {
    return 60 * 15;
  }

  private refreshExpiresInSeconds() {
    return 60 * 60 * 24 * 30;
  }

  private passwordResetTokenTtlSeconds() {
    return 60 * 60; // 1h
  }

  private passwordResetMaxActivePerUser() {
    return 5;
  }

  private requestIp(req?: Request) {
    if (!req) return null;
    const fwd = (req.headers['x-forwarded-for'] as string | undefined) ?? '';
    if (fwd) return String(fwd).split(',')[0]?.trim() ?? null;
    return req.ip ?? null;
  }

  private requestUserAgent(req?: Request) {
    if (!req) return null;
    const ua = req.headers['user-agent'];
    return typeof ua === 'string' ? ua.slice(0, 512) : null;
  }

  private resetLink(token: string, tenantSlug?: string | null) {
    const base = (this.config.get('APP_BASE_URL') ?? '').trim().replace(/\/+$/, '') || '';
    const slug = tenantSlug ? encodeURIComponent(tenantSlug) : '';
    const q = new URLSearchParams({ token });
    if (slug) q.set('tenant', slug);
    return `${base}/reset-password?${q.toString()}`;
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

  async login(params: { tenantId?: string; email: string; password: string; req?: Request }) {
    if (!params.tenantId && params.req) {
      const host = requestHost(params.req);
      const base = baseDomain();
      if (host && base) {
        const slug = tenantSlugFromHost(host, base);
        if (slug) {
          const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
          if (!tenant) throw new UnauthorizedException();
          params.tenantId = tenant.id;
        }
      }
    }

    if (params.tenantId) {
      const user = await this.users.findByEmailInTenant(params.tenantId, params.email);
      if (user && user.status === 'invited') throw invitePendingError();
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

    const candidates = await this.users.findManyByEmail(params.email);
    const activeCandidates = candidates.filter((u) => u.status === 'active');

    const matches: typeof activeCandidates = [];
    for (const candidate of activeCandidates) {
      if (await argon2.verify(candidate.passwordHash, params.password)) {
        matches.push(candidate);
      }
    }

    if (matches.length === 0) {
      if (activeCandidates.length === 0 && candidates.some((u) => u.status === 'invited')) {
        throw invitePendingError();
      }
      if (activeCandidates.length === 1) {
        const user = activeCandidates[0];
        await this.audit.log({
          tenantId: user.tenantId,
          actorType: 'system',
          action: 'auth.login_failed',
          entity: 'User',
          entityId: user.id,
          req: params.req,
        });
      }
      throw new UnauthorizedException();
    }

    if (matches.length > 1) {
      throw new ConflictException({
        code: 'multiple_tenants',
        tenants: matches.map((u) => ({
          tenantId: u.tenantId,
          tenantSlug: u.tenant.slug,
          tradeName: u.tenant.tradeName,
          legalName: u.tenant.legalName,
        })),
      });
    }

    const user = matches[0];

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

  async changePassword(user: { userId: string; tenantId: string }, dto: ChangePasswordDto) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    if (current.tenantId !== user.tenantId || current.status !== 'active') throw new ForbiddenException();

    const ok = await argon2.verify(current.passwordHash, dto.currentPassword);
    if (!ok) throw new UnauthorizedException();

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: current.id },
      data: { passwordHash, refreshTokenHash: null },
    });

    await this.audit.log({
      tenantId: current.tenantId,
      actorType: 'user',
      actorUserId: current.id,
      action: 'auth.password_changed',
      entity: 'User',
      entityId: current.id,
    });

    return { ok: true };
  }

  async forgotPassword(dto: ForgotPasswordDto, req?: Request) {
    const emailNormalized = normalizeEmail(dto.email);

    let tenantId: string | null = null;
    let tenantSlug: string | null = null;

    if (dto.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId }, select: { id: true, slug: true } });
      if (tenant) {
        tenantId = tenant.id;
        tenantSlug = tenant.slug;
      }
    } else if (req) {
      const host = requestHost(req);
      const base = baseDomain();
      if (host && base) {
        const slug = tenantSlugFromHost(host, base);
        if (slug) {
          const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true } });
          if (tenant) {
            tenantId = tenant.id;
            tenantSlug = tenant.slug;
          }
        }
      }
    }

    const candidates = await this.prisma.user.findMany({
      where: {
        emailNormalized,
        status: 'active',
        ...(tenantId ? { tenantId } : {}),
      },
      include: { tenant: { select: { slug: true, tradeName: true } } },
      take: 5,
    });

    if (!candidates.length) {
      // Never reveal whether an email exists or not
      return { ok: true, sent: 0 };
    }

    const ip = this.requestIp(req);
    const ua = this.requestUserAgent(req);
    const ttlSeconds = this.passwordResetTokenTtlSeconds();
    const maxActive = this.passwordResetMaxActivePerUser();

    let sent = 0;
    for (const user of candidates) {
      const activeCount = await this.prisma.passwordResetToken.count({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      });
      if (activeCount >= maxActive) continue;

      const tokenBytes = randomBytes(32);
      const token = tokenBytes.toString('base64url');
      const tokenHash = sha256(token);
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      try {
        await this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tenantId: user.tenantId,
            tokenHash,
            expiresAt,
            ip,
            userAgent: ua,
          },
        });
      } catch {
        continue;
      }

      const link = this.resetLink(token, tenantSlug ?? user.tenant.slug);
      const tradeName = (user.tenant as any)?.tradeName ?? 'Opiina';

      const subject = `Redefinição de senha - ${tradeName}`;
      const text = [
        `Olá, ${user.name}.`,
        '',
        `Recebemos uma solicitação para redefinir a senha da sua conta em ${tradeName}.`,
        `Se não foi você, ignore este e-mail.`,
        '',
        `Clique no link abaixo para criar uma nova senha (válido por ${Math.round(ttlSeconds / 60)} minutos):`,
        link,
        '',
        `Atenciosamente, Equipe ${tradeName} / Opiina`,
      ].join('\n');
      const html = `
        <div style="font-family: system-ui, sans-serif; color: #0f172a; line-height: 1.5;">
          <p>Olá, <strong>${escapeHtml(user.name)}</strong>.</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta em <strong>${escapeHtml(tradeName)}</strong>.</p>
          <p>Se não foi você, ignore este e-mail.</p>
          <p style="margin: 20px 0;">
            <a href="${link}" style="background:#0b75d1;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
              Redefinir minha senha
            </a>
          </p>
          <p style="word-break:break-all;color:#475569;">
            Ou copie e cole este endereço no navegador:<br/>
            ${escapeHtml(link)}
          </p>
          <p>Validade: ${Math.round(ttlSeconds / 60)} minutos.</p>
          <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;"/>
          <p style="color:#475569;font-size:12px;">Atenciosamente, Equipe ${escapeHtml(tradeName)} / Opiina</p>
        </div>
      `;

      await this.mailer.send({ to: user.email, subject, text, html });

      await this.audit.log({
        tenantId: user.tenantId,
        actorType: 'system',
        action: 'auth.password_reset_requested',
        entity: 'User',
        entityId: user.id,
        req,
      });

      sent += 1;
    }

    return { ok: true, sent };
  }

  async resetPassword(dto: ResetPasswordDto, req?: Request) {
    const token = (dto.token ?? '').trim();
    if (!token) throw new NotFoundException();

    const tokenHash = sha256(token);
    const now = new Date();
    const row = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: { user: { select: { id: true, tenantId: true, status: true } } },
    });

    if (!row) throw new NotFoundException();
    if (row.usedAt) throw new ForbiddenException('token_used');
    if (row.expiresAt < now) throw new ForbiddenException('token_expired');
    if (!row.user || row.user.status !== 'active') throw new ForbiddenException('user_inactive');

    const password = dto.password ?? '';
    if (password.length < 8) throw new ForbiddenException('password_too_short');

    const passwordHash = await argon2.hash(password);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: {
          usedAt: new Date(),
          ip: this.requestIp(req),
          userAgent: this.requestUserAgent(req),
        },
      });
      await tx.user.update({
        where: { id: row.user!.id },
        data: { passwordHash, refreshTokenHash: null, updatedAt: new Date() },
      });
    });

    await this.audit.log({
      tenantId: row.tenantId,
      actorType: 'user',
      actorUserId: row.user!.id,
      action: 'auth.password_reset_completed',
      entity: 'User',
      entityId: row.user!.id,
      req,
    });

    return { ok: true };
  }

  async acceptInvite(dto: AcceptInviteDto, req?: Request) {
    const token = (dto.token ?? '').trim();
    if (!token) throw new NotFoundException('invite_not_found');

    const row = await this.prisma.userInviteToken.findFirst({
      where: { tokenHash: sha256(token) },
      include: { user: { select: { id: true, tenantId: true, status: true, email: true } } },
    });
    if (!row || !row.user) throw new NotFoundException('invite_not_found');
    if (row.usedAt) throw new ForbiddenException('invite_used');
    if (row.revokedAt) throw new ForbiddenException('invite_revoked');
    if (row.expiresAt < new Date()) throw new ForbiddenException('invite_expired');
    if (row.user.status !== 'invited') throw new ForbiddenException('user_not_invited');

    const password = dto.password ?? '';
    if (password.length < 8) throw new BadRequestException('password_too_short');
    const passwordHash = await argon2.hash(password);

    await this.prisma.$transaction(async (tx) => {
      await tx.userInviteToken.update({
        where: { id: row.id },
        data: {
          usedAt: new Date(),
          ip: this.requestIp(req),
          userAgent: this.requestUserAgent(req),
        },
      });
      await tx.user.update({
        where: { id: row.user.id },
        data: { passwordHash, status: 'active', refreshTokenHash: null },
      });
    });

    await this.audit.log({
      tenantId: row.tenantId,
      actorType: 'user',
      actorUserId: row.user.id,
      action: 'auth.invite_accepted',
      entity: 'User',
      entityId: row.user.id,
      req,
    });

    return { ok: true, tenantId: row.tenantId, email: row.user.email };
  }

  async updateMe(user: { userId: string; tenantId: string }, dto: UpdateMeDto) {
    const data: { name?: string; phone?: string | null } = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('invalid_name');
      data.name = name.slice(0, 200);
    }
    if (dto.phone !== undefined) {
      // Mesmo formato do cadastro de usuários: apenas dígitos.
      data.phone = (dto.phone ?? '').replace(/\D+/g, '').slice(0, 30) || null;
    }

    const current = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, tenantId: true, status: true },
    });
    if (!current || current.tenantId !== user.tenantId || current.status !== 'active') {
      throw new ForbiddenException();
    }

    const updated = Object.keys(data).length
      ? await this.prisma.user.update({
          where: { id: current.id },
          data,
          select: { id: true, name: true, email: true, phone: true },
        })
      : await this.prisma.user.findUniqueOrThrow({
          where: { id: current.id },
          select: { id: true, name: true, email: true, phone: true },
        });

    await this.audit.log({
      tenantId: user.tenantId,
      actorType: 'user',
      actorUserId: user.userId,
      action: 'auth.profile_updated',
      entity: 'User',
      entityId: user.userId,
      summary: { fields: Object.keys(data) },
    });

    return { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone ?? null };
  }
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
