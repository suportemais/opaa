import { randomBytes } from 'node:crypto';
import { sha256 } from '../common/crypto';

/** Validade do convite (7 dias). */
export const USER_INVITE_TTL_SECONDS = 60 * 60 * 24 * 7;

export function generateInviteToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: sha256(token) };
}

export function inviteLink(params: {
  webUrl?: string | null;
  appBaseUrl?: string | null;
  token: string;
  tenantSlug?: string | null;
}) {
  const base =
    (params.webUrl ?? '').trim().replace(/\/+$/, '') ||
    (params.appBaseUrl ?? '').trim().replace(/\/+$/, '') ||
    '';
  const q = new URLSearchParams({ token: params.token });
  if (params.tenantSlug) q.set('tenant', params.tenantSlug);
  return `${base}/convite?${q.toString()}`;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function inviteEmail(params: {
  name: string;
  tradeName: string;
  invitedBy?: string | null;
  link: string;
  ttlSeconds?: number;
}) {
  const days = Math.round(
    (params.ttlSeconds ?? USER_INVITE_TTL_SECONDS) / 86400,
  );
  const by = params.invitedBy ? ` por ${params.invitedBy}` : '';
  const subject = `Convite para acessar o painel - ${params.tradeName}`;
  const text = [
    `Olá, ${params.name}.`,
    '',
    `Você foi convidado(a)${by} para acessar o painel de ${params.tradeName} no Opiina.`,
    '',
    `Clique no link abaixo para criar sua senha e ativar o acesso (válido por ${days} dias):`,
    params.link,
    '',
    'Se você não esperava este convite, ignore este e-mail.',
    '',
    `Atenciosamente, Equipe ${params.tradeName} / Opiina`,
  ].join('\n');
  const html = `
    <div style="font-family: system-ui, sans-serif; color: #0f172a; line-height: 1.5;">
      <p>Olá, <strong>${escapeHtml(params.name)}</strong>.</p>
      <p>Você foi convidado(a)${escapeHtml(by)} para acessar o painel de <strong>${escapeHtml(params.tradeName)}</strong> no Opiina.</p>
      <p style="margin: 20px 0;">
        <a href="${params.link}" style="background:#0b75d1;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
          Aceitar convite e criar senha
        </a>
      </p>
      <p style="word-break:break-all;color:#475569;">
        Ou copie e cole este endereço no navegador:<br/>
        ${escapeHtml(params.link)}
      </p>
      <p>Validade: ${days} dias. Se você não esperava este convite, ignore este e-mail.</p>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <p style="color:#475569;font-size:12px;">Atenciosamente, Equipe ${escapeHtml(params.tradeName)} / Opiina</p>
    </div>
  `;
  return { subject, text, html };
}
