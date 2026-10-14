import type { NomeIcone } from '../Icone';
import type { ExtraQuestionKind } from '../../../lib/question-types';

export type Unit = { id: string; name: string };

export type SurveyStatus = 'draft' | 'published' | 'archived' | string;

/** Item de GET /surveys?includeArchived=true */
export type SurveyListItem = {
  id: string;
  name: string;
  description?: string | null;
  status: SurveyStatus;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  responsesCount?: number;
  units: Array<{ unitId: string; unit: Unit }>;
};

export type SurveyQuestionDetail = {
  id: string;
  title: string;
  type: string;
  required: boolean;
  order?: number;
  config?: { when?: { npsMax?: number; npsMin?: number } } | null;
  options?: Array<{ id?: string; label: string; value: string; negative?: boolean; order?: number }>;
};

/** GET /surveys/:id */
export type SurveyDetail = {
  id: string;
  name: string;
  description: string | null;
  status: SurveyStatus;
  collectCustomer: boolean;
  anonymousAllowed: boolean;
  collectEmployee: boolean;
  createdAt?: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  units: Array<{ unitId: string; unit: Unit }>;
  draftVersion: { questions: SurveyQuestionDetail[] } | null;
};

/** GET /surveys/:id/distributions */
export type Distribution = {
  id: string;
  surveyId: string;
  unitId: string | null;
  employeeId: string | null;
  channel: string;
  campaign: string | null;
  publicToken: string;
  active: boolean;
  createdAt: string;
  unit?: Unit | null;
  employee?: { id: string; name: string } | null;
};

export const NOMES_STATUS: Record<string, { rotulo: string; classe: string }> = {
  published: { rotulo: 'Publicada', classe: 'status--publicada' },
  draft: { rotulo: 'Rascunho', classe: 'status--rascunho' },
  archived: { rotulo: 'Arquivada', classe: 'status--arquivada' },
};

/** Tipos que o editor oferece (rótulos e ícones do protótipo; valores do app). */
export const TIPOS_PERGUNTA: Array<{ kind: ExtraQuestionKind; nome: string; icone: NomeIcone }> = [
  { kind: 'open', nome: 'Texto livre', icone: 'texto' },
  { kind: 'scale_1_10', nome: 'Nota de 1 a 10', icone: 'nota10' },
  { kind: 'thumbs', nome: 'Gostei / não gostei', icone: 'polegar' },
  { kind: 'stars_1_5', nome: 'Estrelas (1 a 5)', icone: 'estrela' },
  { kind: 'single_choice', nome: 'Escolha única', icone: 'escolha' },
];

export const CANAIS: Array<{ valor: string; nome: string }> = [
  { valor: 'qrcode', nome: 'QR Code' },
  { valor: 'link', nome: 'Link' },
  { valor: 'whatsapp', nome: 'WhatsApp' },
  { valor: 'email', nome: 'E-mail' },
  { valor: 'sms', nome: 'SMS' },
];

export const nomeCanal = (c: string) => CANAIS.find((x) => x.valor === c)?.nome ?? c;

export const NPS_TITULO_PADRAO = 'De 1 a 10, o quanto você nos recomendaria?';

export function dataHora(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function quandoRelativo(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const dias = Math.round((b - a) / 864e5);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias > 1) return `há ${dias} dias`;
  return '';
}

export const slug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function mensagemErro(err: unknown, padrao: string) {
  const body = (err as { body?: unknown } | null)?.body;
  const msg =
    body && typeof body === 'object' && 'message' in body ? (body as { message?: unknown }).message : undefined;
  const code = Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : '';
  const conhecidos: Record<string, string> = {
    only_draft_editable: 'Só rascunhos podem ser editados.',
    nps_required_first: 'A nota de recomendação precisa ser a primeira pergunta.',
    single_choice_options_required: 'Perguntas de escolha precisam de pelo menos 2 opções.',
    survey_not_archived: 'Esta pesquisa não está arquivada.',
    no_draft_version: 'Esta pesquisa não tem rascunho para publicar.',
  };
  return conhecidos[code] ?? padrao;
}

// ---------- Identificação (atendente e contato do cliente) ----------
export type Identidade = {
  collectEmployee: boolean;
  collectCustomer: boolean;
  requireCustomerIdentity: boolean;
};

export function identidadeDaPesquisa(s: {
  collectCustomer: boolean;
  anonymousAllowed: boolean;
  collectEmployee: boolean;
}): Identidade {
  return {
    collectEmployee: Boolean(s.collectEmployee),
    collectCustomer: Boolean(s.collectCustomer),
    requireCustomerIdentity: Boolean(s.collectCustomer) && s.anonymousAllowed === false,
  };
}

export function payloadIdentidade(i: Identidade) {
  return {
    collectCustomer: i.collectCustomer,
    anonymousAllowed: i.collectCustomer ? !i.requireCustomerIdentity : true,
    collectEmployee: i.collectEmployee,
  };
}

