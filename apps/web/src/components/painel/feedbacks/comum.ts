// Tipos e utilidades compartilhadas por Feedbacks (lista/Kanban), gaveta de tratamento e detalhe.
import { feedbackCaseEventLabel, feedbackCasePriorityLabel, feedbackCaseStatusLabel, interactionChannelLabel } from '../../../lib/labels';

export type CasoResumo = {
  id: string;
  status: string;
  priority: string;
  dueAt: string | null;
  assigneeUserId: string | null;
  assignee: { id: string; name: string; email: string } | null;
};

export type FeedbackItem = {
  id: string;
  completedAt: string | null;
  npsScore: number | null;
  npsClass: string | null;
  mainComment: string | null;
  sentiment: 'elogio' | 'reclamacao' | 'neutro' | null;
  sentimentTheme: string | null;
  unit: { id: string; name: string } | null;
  employee: { id: string; name: string } | null;
  customer: { id: string; name: string | null } | null;
  feedbackCase: CasoResumo | null;
};

export type KanbanItem = {
  id: string;
  status: string;
  priority: string;
  dueAt: string | null;
  updatedAt: string;
  createdAt: string;
  assigneeUserId: string | null;
  assignee: { id: string; name: string; email: string } | null;
  unit: { id: string; name: string } | null;
  customer: { id: string; name: string | null; email: string | null; phone: string | null; doNotContact: boolean } | null;
  surveyResponse: { id: string; completedAt: string | null; npsScore: number | null; npsClass: string | null; mainComment: string | null };
};

export type EventoCaso = {
  id: string;
  type: string;
  createdAt: string;
  data?: unknown;
  createdBy?: { id: string; name: string; email: string } | null;
};

export type FeedbackDetalhe = {
  id: string;
  completedAt: string | null;
  channel?: string | null;
  npsScore: number | null;
  npsClass: string | null;
  mainComment: string | null;
  sentiment: string | null;
  sentimentTheme: string | null;
  sentimentSummary?: string | null;
  survey?: { id: string; name: string } | null;
  unit?: { id: string; name: string } | null;
  employee?: { id: string; name: string } | null;
  customerId: string | null;
  customer: null | {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    doNotContact?: boolean;
  };
  answers: Array<{ id: string; question: { title: string; type: string }; value: unknown }>;
  feedbackCase: null | {
    id: string;
    status: string;
    priority: string;
    dueAt: string | null;
    assigneeUserId: string | null;
    assignee?: { id: string; name: string; email: string } | null;
    rootCause?: string | null;
    correctiveAction?: string | null;
    resolution?: string | null;
    createdAt?: string;
    events: EventoCaso[];
  };
};

export type CaseInteraction = {
  id: string;
  channel: string;
  direction: string;
  outcome: string | null;
  notes: string | null;
  createdAt: string;
  createdByUser?: { id: string; name: string; email: string } | null;
};

export type Unidade = { id: string; name: string };

/** As 7 etapas do caso (valores da API), na ordem do fluxo. */
export const ETAPAS = ['new', 'viewed', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'dismissed'] as const;
export const ETAPAS_ABERTAS = ['new', 'viewed', 'in_progress', 'waiting_customer'];
export const PRIORIDADES = ['low', 'normal', 'high', 'urgent'] as const;

/** Classe visual da etapa (cores do protótipo; encerrada/descartada em painel-feedbacks.css). */
export function classeEtapa(status: string) {
  const mapa: Record<string, string> = {
    new: 'nova',
    viewed: 'visualizada',
    in_progress: 'em-andamento',
    waiting_customer: 'aguardando-cliente',
    resolved: 'resolvida',
    closed: 'encerrada',
    dismissed: 'descartada',
  };
  return `etapa etapa--${mapa[status] ?? 'visualizada'}`;
}

export function classeNota(npsClass: string | null | undefined) {
  if (npsClass === 'detractor') return 'nota nota--detrator';
  if (npsClass === 'passive') return 'nota nota--passivo';
  if (npsClass === 'promoter') return 'nota nota--promotor';
  return 'nota';
}

/** Rótulo local de classe NPS: "Passivo" (Neutro é sentimento, não classe NPS). */
export function rotuloClasseNps(npsClass: string | null | undefined) {
  if (npsClass === 'detractor') return 'Detrator';
  if (npsClass === 'passive') return 'Passivo';
  if (npsClass === 'promoter') return 'Promotor';
  return '—';
}

export const etapaRotulo = feedbackCaseStatusLabel;
export const prioridadeRotulo = feedbackCasePriorityLabel;

const dataCurta = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function dataHora(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${dataCurta(d)} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function dataCompleta(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "hoje", "ontem", "há N dias". */
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

/**
 * Dia (local, 00:00) a que o prazo se refere. Prazos gravados só com a data (meia-noite UTC)
 * são lidos pela data UTC, para não "voltarem" um dia no fuso do Brasil.
 */
export function diaDoPrazo(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Texto e classe do prazo, como no protótipo. */
export function prazoInfo(status: string, dueAt: string | null): { texto: string; classe: string } {
  if (!ETAPAS_ABERTAS.includes(status)) return { texto: feedbackCaseStatusLabel(status), classe: '' };
  const dia = diaDoPrazo(dueAt);
  if (!dia) return { texto: 'Sem prazo', classe: '' };
  const d = dia;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((dia.getTime() - hoje.getTime()) / 86400000);
  if (diff < 0) return { texto: `Venceu há ${-diff} ${diff === -1 ? 'dia' : 'dias'}`, classe: 'prazo prazo--vencido' };
  if (diff === 0) return { texto: 'Vence hoje', classe: 'prazo prazo--hoje' };
  if (diff === 1) return { texto: 'Vence amanhã', classe: 'prazo' };
  return { texto: `Vence em ${dataCurta(d)}`, classe: 'prazo' };
}

/** aaaa-mm-dd (para <input type="date">) a partir do ISO da API, no fuso local. */
export function paraInputData(iso: string | null | undefined) {
  const d = diaDoPrazo(iso);
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** aaaa-mm-dd → ISO ao meio-dia local (cai no mesmo dia em UTC e no fuso do Brasil). */
export function deInputData(v: string) {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function lerDado(data: unknown, chave: string): unknown {
  if (data && typeof data === 'object' && chave in data) return (data as Record<string, unknown>)[chave];
  return undefined;
}

/** Texto legível de um evento do caso (inclui a anotação interna 'case.note'). */
export function textoEvento(e: EventoCaso, nomeUsuario: (id: string) => string | undefined): string {
  const para = lerDado(e.data, 'to');
  switch (e.type) {
    case 'case.note': {
      const t = lerDado(e.data, 'text');
      return `Anotação: ${typeof t === 'string' ? t : ''}`;
    }
    case 'case.status_changed':
      return typeof para === 'string' ? `Etapa alterada para "${feedbackCaseStatusLabel(para)}"` : 'Etapa alterada';
    case 'case.priority_changed':
      return typeof para === 'string' ? `Prioridade alterada para ${feedbackCasePriorityLabel(para)}` : 'Prioridade alterada';
    case 'case.assignee_changed': {
      if (para === null) return 'Responsável removido';
      const nome = typeof para === 'string' ? nomeUsuario(para) : undefined;
      return nome ? `Atribuída a ${nome}` : 'Responsável alterado';
    }
    case 'case.due_changed': {
      if (para === null) return 'Prazo removido';
      const dia = typeof para === 'string' ? diaDoPrazo(para) : null;
      return dia ? `Prazo alterado para ${dia.toLocaleDateString('pt-BR')}` : 'Prazo alterado';
    }
    case 'case.contact_logged': {
      const canal = lerDado(e.data, 'channel');
      return typeof canal === 'string' ? `Contato registrado (${interactionChannelLabel(canal)})` : 'Contato registrado';
    }
    default:
      return feedbackCaseEventLabel(e.type);
  }
}

/** Nome do cliente para exibição. */
export function nomeCliente(c: { name?: string | null; email?: string | null; phone?: string | null } | null | undefined) {
  return c?.name?.trim() || c?.email?.trim() || c?.phone?.trim() || 'Anônimo';
}
