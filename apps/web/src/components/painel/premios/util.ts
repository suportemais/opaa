import { ApiError } from '../../../lib/api';
import type { CouponCampaignStatus } from '../../../lib/api-novos';

export type Pesquisa = { id: string; name: string; status: string };

export type Campanha = {
  id: string;
  name: string;
  description?: string | null;
  surveyId: string | null;
  surveyName: string | null;
  mmCompanyId: string | null;
  rewardAmountCents: number | null;
  validityDays: number | null;
  startsAt: string | null;
  endsAt: string | null;
  message: string | null;
  prefix: string | null;
  status: CouponCampaignStatus | string;
  totalLimit?: number | null;
  perCustomerLimit: number;
  issuedCount: number;
  redeemedCount: number;
  createdAt?: string;
  unitId?: string | null;
  unitName?: string | null;
  cnpj?: string | null;
  issuer?: { cnpj: string; legalName: string; tradeName: string } | null;
};

export type UnidadeCnpj = {
  id: string;
  name: string;
  document: string | null;
  legalName?: string | null;
};

/** Muito Mais Company.id + Company.tradeName — nunca um estabelecimento. */
export type EmpresaMm = { id: string; tradeName: string };
export type OpcaoEmpresa = { id: string; label: string };

/** Placeholders reais gravados na mensagem (o servidor troca por valor, código e link). */
export const TOKENS = [
  { token: '{{amount}}', rotulo: 'Valor' },
  { token: '{{code}}', rotulo: 'Código do voucher' },
  { token: '{{link}}', rotulo: 'Link de resgate' },
] as const;

export const MENSAGEM_PADRAO = 'Seu prêmio de R$ {{amount}}:\n{{code}}\nResgate: {{link}}';

/** Situação exibida: "agendada" vem de startsAt no futuro; "encerrada" também cobre fim já passado. */
export type Situacao = 'ativa' | 'pausada' | 'rascunho' | 'agendada' | 'encerrada';

export const SITUACAO: Record<Situacao, { rotulo: string; classe: string }> = {
  ativa: { rotulo: 'Ativa', classe: 'publicada' },
  pausada: { rotulo: 'Pausada', classe: 'rascunho' },
  rascunho: { rotulo: 'Rascunho', classe: 'rascunho' },
  agendada: { rotulo: 'Agendada', classe: 'agendada' },
  encerrada: { rotulo: 'Encerrada', classe: 'arquivada' },
};

export function situacaoDa(c: Campanha, agora = Date.now()): Situacao {
  if (c.status === 'finished') return 'encerrada';
  const fim = c.endsAt ? new Date(c.endsAt).getTime() : NaN;
  if (Number.isFinite(fim) && fim < agora) return 'encerrada';
  if (c.status === 'paused') return 'pausada';
  const inicio = c.startsAt ? new Date(c.startsAt).getTime() : NaN;
  if (Number.isFinite(inicio) && inicio > agora) return 'agendada';
  if (c.status === 'draft') return 'rascunho';
  return 'ativa';
}

export function reaisDeCentavos(cents: number | null | undefined) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function real(cents: number | null | undefined) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function centavosDeReais(raw: string) {
  const t = raw.trim().replace(/[R$\s]/g, '');
  if (!t) return null;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normal);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function paraDataHoraLocal(valor: string | null | undefined) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function deDataHoraLocal(valor: string) {
  if (!valor.trim()) return undefined;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function dataCurta(valor: string | null | undefined) {
  if (!valor) return '';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function diasAte(valor: string | null | undefined, agora = Date.now()) {
  if (!valor) return null;
  const t = new Date(valor).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - agora) / 864e5);
}

/** Rótulo do operador = MM Company.tradeName. Nunca nome do tenant/unidade/estabelecimento. */
export function opcoesEmpresa(empresas: EmpresaMm[], selecionada?: string | null): OpcaoEmpresa[] {
  const op = empresas
    .filter((e) => e.id.trim() && e.tradeName.trim())
    .map((e) => ({ id: e.id.trim(), label: `${e.tradeName.trim()} — MM` }));
  const sel = selecionada?.trim();
  if (sel && !op.some((o) => o.id === sel)) op.push({ id: sel, label: 'Empresa Muito Mais' });
  return op;
}

export function erroCampanha(err: unknown): string {
  const codigo =
    err instanceof ApiError && typeof err.body === 'object' && err.body && 'message' in err.body
      ? String((err.body as { message?: unknown }).message)
      : err instanceof Error
        ? err.message
        : '';
  switch (codigo) {
    case 'issuer_cnpj_required':
      return 'Cadastre um CNPJ válido nesta unidade para emitir o voucher.';
    case 'unit_required':
      return 'Escolha a unidade antes de gerar.';
    case 'unit_not_found':
      return 'Unidade não encontrada.';
    case 'invalid_document':
      return 'Informe um CNPJ válido da unidade.';
    case 'mm_company_not_linked':
      return 'Essa empresa Muito Mais não está vinculada. Confira em Integrações.';
    case 'mm_company_id_required':
      return 'Selecione a empresa Muito Mais.';
    case 'survey_not_found':
      return 'Pesquisa não encontrada.';
    case 'invalid_date':
      return 'Confira as datas de início e fim.';
    case 'campaign_not_found':
      return 'Campanha não encontrada.';
    default:
      if (err instanceof ApiError && err.status === 403) return 'Você não tem permissão para isso.';
      return codigo && codigo !== 'ApiError' ? codigo : 'Falha ao salvar a campanha.';
  }
}
