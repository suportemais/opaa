/**
 * Tipos das respostas/requests adicionados na API para o redesign do painel.
 * Somente tipos — nenhum código em runtime. Os endpoints antigos continuam
 * com os mesmos contratos (campos novos são aditivos).
 */

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

/** GET /metrics/ranking/employees?from&to&unitId (response:read) */
export type EmployeeRankingItem = {
  employeeId: string;
  name: string;
  unitId: string | null;
  unitName: string | null;
  responses: number;
  promotersPct: number | null;
  passivesPct: number | null;
  detractorsPct: number | null;
  nps: number | null;
  /** % de sentimento `elogio` entre respostas com sentimento classificado. */
  elogiosPct: number | null;
};

export type EmployeeRankingResponse = {
  from: string;
  to: string;
  unitId: string | null;
  employees: EmployeeRankingItem[];
};

/** GET /metrics/cases/summary agora aceita `from`/`to` opcionais (createdAt do caso). */
export type CasesSummaryQuery = { unitId?: string; from?: string; to?: string };

// ---------------------------------------------------------------------------
// Feedbacks
// ---------------------------------------------------------------------------

/** Novos query params opcionais de GET /feedbacks. */
export type FeedbackListExtraQuery = {
  /** Busca case-insensitive no comentário e no nome do cliente. */
  q?: string;
  hasComment?: 'true' | 'false';
};

/** Campos adicionados a cada item de GET /feedbacks. */
export type FeedbackListItemExtras = {
  sentiment: 'elogio' | 'reclamacao' | 'neutro' | null;
  sentimentTheme: string | null;
  unit: { id: string; name: string } | null;
  employee: { id: string; name: string } | null;
  customer: { id: string; name: string | null } | null;
};

/** POST /feedbacks/:id/case/notes (feedback:manage) */
export type CreateCaseNoteRequest = { text: string };

/** Evento retornado (também aparece em feedbackCase.events do GET /feedbacks/:id). */
export type FeedbackCaseNoteEvent = {
  id: string;
  tenantId: string;
  feedbackCaseId: string;
  type: 'case.note';
  data: { text: string };
  createdAt: string;
  createdByUserId: string | null;
  createdBy: { id: string; name: string; email: string } | null;
};

// ---------------------------------------------------------------------------
// Usuários / Auth
// ---------------------------------------------------------------------------

/** GET /users/assignable (feedback:manage) */
export type AssignableUser = { id: string; name: string };

export type UserStatus = 'active' | 'disabled' | 'invited';

/** POST /users/invite (user:manage) */
export type InviteUserRequest = {
  name: string;
  email: string;
  roleCode: string;
  unitIds?: string[];
};

/** Resposta de POST /users/invite e POST /users/:id/resend-invite */
export type InviteUserResponse = {
  id: string;
  status: 'invited';
  expiresAt: string;
  /** false quando o SMTP não está configurado ou falhou. */
  inviteSent: boolean;
  /** true quando o e-mail já tinha convite pendente e ele foi reenviado. */
  resent?: boolean;
};

/** POST /auth/accept-invite (público) */
export type AcceptInviteRequest = { token: string; password: string };
export type AcceptInviteResponse = { ok: true; tenantId: string; email: string };

/** Erro 401 do login para usuário com convite pendente. */
export type InvitePendingError = {
  statusCode: 401;
  code: 'user_invited';
  message: string;
};

/** Campo adicionado em GET /auth/me */
export type AuthMeExtras = { roleNames: string[] };

/** PATCH /auth/me */
export type UpdateMeRequest = { name?: string; phone?: string };
export type UpdateMeResponse = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

// ---------------------------------------------------------------------------
// Denúncias
// ---------------------------------------------------------------------------

/**
 * GET /whistleblower?status=… agora aceita `open` (= received|analyzing|
 * investigating|awaiting_info) e lista separada por vírgula.
 */
export type WhistleblowerStatusFilter = string;

/** GET /whistleblower/summary?unitId */
export type WhistleblowerSummary = {
  unitId: string | null;
  novas: number;
  emAndamento: number;
  altaCritica: number;
  /** Concluídas nos últimos 90 dias (por updatedAt). */
  concluidas90d: number;
};

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export type CustomerSource = 'survey' | 'import' | 'manual';

/** Campos adicionados ao Customer (lista e detalhe). */
export type CustomerExtras = {
  source: CustomerSource | null;
  /** Último opt-in de ofertas; null = nunca informado. */
  acceptsOffers: boolean | null;
  acceptsOffersAt: string | null;
  birthDate: string | null;
};

/** Novos query params de GET /customers. */
export type CustomerListQuery = {
  q?: string;
  unitId?: string;
  offers?: 'sim' | 'nao';
  birthdayMonth?: number;
  source?: CustomerSource;
  /** Quando enviado, a resposta passa a ser paginada. */
  page?: number;
  /** máx. 200 (padrão 50) */
  pageSize?: number;
};

export type CustomerListPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/** POST /customers (customer:manage) — cadastro manual (source = 'manual'). */
export type CreateCustomerRequest = {
  name: string;
  email?: string;
  phone?: string;
  originUnitId?: string;
  /** aaaa-mm-dd ou dd/mm/aaaa */
  birthDate?: string;
  acceptsOffers?: boolean;
  notes?: string;
};

/** Campos adicionados ao PATCH /customers/:id */
export type UpdateCustomerExtras = {
  /** aaaa-mm-dd ou dd/mm/aaaa; "" remove */
  birthDate?: string;
  acceptsOffers?: boolean;
};

/** Campos adicionados ao customer do envio público da pesquisa. */
export type SubmitCustomerExtras = {
  /** aaaa-mm-dd */
  birthDate?: string;
  acceptsOffers?: boolean;
};

// ---------------------------------------------------------------------------
// Pesquisas
// ---------------------------------------------------------------------------

/** Campos adicionados aos itens de GET /surveys (?includeArchived=true inclui arquivadas). */
export type SurveyListItemExtras = {
  responsesCount: number;
  publishedAt: string | null;
  archivedAt: string | null;
};

/** POST /surveys/:id/unarchive (survey:manage) */
export type UnarchiveSurveyResponse = { ok: true; status: 'published' | 'draft' };

// ---------------------------------------------------------------------------
// Campanhas de cupom
// ---------------------------------------------------------------------------

/** POST /coupon-campaigns/:id/finish (survey:manage) → campanha com status 'finished'. */
export type CouponCampaignStatus = 'draft' | 'active' | 'paused' | 'finished';
