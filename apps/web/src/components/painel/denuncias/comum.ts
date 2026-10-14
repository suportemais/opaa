import { whistleblowerCategoryLabel } from '../../../lib/labels';

export type Pessoa = { id: string; name: string; email?: string };

export type DenunciaLinha = {
  id: string;
  protocol: string;
  category: string;
  customCategory: string | null;
  title: string;
  description?: string;
  status: string;
  priority: string;
  reporterAnonymous: boolean;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  assigneeUserId?: string | null;
  createdAt: string;
  unit: { id: string; name: string } | null;
  assignee?: Pessoa | null;
};

export type DenunciaEvento = {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  assigneeUserId: string | null;
  createdById: string | null;
  createdAt: string;
  createdBy: Pessoa | null;
  assignee: Pessoa | null;
};

export type DenunciaDetalhe = DenunciaLinha & {
  publicToken: string;
  description: string;
  occurredAt: string | null;
  locationText: string | null;
  involvedPeople: string | null;
  witnesses: string | null;
  additionalInfo: string | null;
  reporterDoc: string | null;
  assigneeUserId: string | null;
  updatedAt: string;
  assignee: Pessoa | null;
  events: DenunciaEvento[];
};

/** Valores da API (WhistleblowerCategory); rótulos de lib/labels. */
export const CATEGORIAS = [
  'moral_harassment',
  'sexual_harassment',
  'discrimination',
  'racism',
  'racial_injury',
  'homophobia',
  'transphobia',
  'religious_intolerance',
  'fraud',
  'corruption',
  'conflict_of_interest',
  'policy_violation',
  'work_safety',
  'lgpd_privacy',
  'misconduct',
  'other',
] as const;

export const SITUACOES = ['received', 'analyzing', 'investigating', 'awaiting_info', 'completed', 'archived'] as const;
export const SITUACOES_ABERTAS = ['received', 'analyzing', 'investigating', 'awaiting_info'];
/** Mais grave primeiro (como no protótipo). */
export const PRIORIDADES = ['critical', 'high', 'medium', 'low'] as const;
const PESO_PRIORIDADE: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const categoriaTexto = (r: { category: string; customCategory: string | null }) =>
  r.category === 'other' && r.customCategory ? r.customCategory : whistleblowerCategoryLabel(r.category);

export const aberta = (status: string) => SITUACOES_ABERTAS.includes(status);

/** Em aberto primeiro; depois a mais grave; depois a mais recente. */
export function ordenarDenuncias<T extends { status: string; priority: string; createdAt: string }>(lista: T[]) {
  return [...lista].sort(
    (a, b) =>
      Number(aberta(b.status)) - Number(aberta(a.status)) ||
      (PESO_PRIORIDADE[a.priority] ?? 9) - (PESO_PRIORIDADE[b.priority] ?? 9) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function dataHora(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Data de calendário (occurredAt é gravado como meia-noite UTC). */
export function dataSimples(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** "hoje", "ontem", "há N dias" (como o protótipo). */
export function quando(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoje.getTime() - dia.getTime()) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

