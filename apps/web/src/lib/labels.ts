export const SENTIMENT_FILTER_VALUES = ['elogio', 'reclamacao', 'neutro'] as const;
export type SentimentFilterValue = (typeof SENTIMENT_FILTER_VALUES)[number];

export const SENTIMENT_THEME_FILTER_VALUES = [
  'atendimento',
  'espera',
  'comida',
  'preco',
  'limpeza',
  'qualidade',
  'ambiente',
  'entrega',
  'produto',
  'outro',
] as const;
export type SentimentThemeFilterValue = (typeof SENTIMENT_THEME_FILTER_VALUES)[number];

export function isSentimentFilterValue(value: string | null | undefined): value is SentimentFilterValue {
  return value === 'elogio' || value === 'reclamacao' || value === 'neutro';
}

export function isSentimentThemeFilterValue(value: string | null | undefined): value is SentimentThemeFilterValue {
  return (SENTIMENT_THEME_FILTER_VALUES as readonly string[]).includes(value ?? '');
}

export function sentimentLabel(value: string | null | undefined) {
  if (value === 'elogio') return 'Elogio';
  if (value === 'reclamacao') return 'Reclamação';
  if (value === 'neutro') return 'Neutro';
  return value ?? '—';
}

export function sentimentThemeLabel(value: string | null | undefined) {
  if (value === 'atendimento') return 'Atendimento';
  if (value === 'espera') return 'Espera';
  if (value === 'comida') return 'Comida';
  if (value === 'preco') return 'Preço';
  if (value === 'limpeza') return 'Limpeza';
  if (value === 'qualidade') return 'Qualidade';
  if (value === 'ambiente') return 'Ambiente';
  if (value === 'entrega') return 'Entrega';
  if (value === 'produto') return 'Produto';
  if (value === 'outro') return 'Outro';
  return value ?? '—';
}

export function npsClassLabel(value: string | null | undefined) {
  if (value === 'detractor') return 'Detrator';
  if (value === 'passive') return 'Neutro';
  if (value === 'promoter') return 'Promotor';
  return value ?? '—';
}

export function feedbackCaseStatusLabel(value: string | null | undefined) {
  if (value === 'new') return 'Nova';
  if (value === 'viewed') return 'Visualizada';
  if (value === 'in_progress') return 'Em andamento';
  if (value === 'waiting_customer') return 'Aguardando cliente';
  if (value === 'resolved') return 'Resolvida';
  if (value === 'closed') return 'Encerrada';
  if (value === 'dismissed') return 'Descartada';
  return value ?? '—';
}

export function feedbackCasePriorityLabel(value: string | null | undefined) {
  if (value === 'low') return 'Baixa';
  if (value === 'normal') return 'Normal';
  if (value === 'high') return 'Alta';
  if (value === 'urgent') return 'Urgente';
  return value ?? '—';
}

export function interactionChannelLabel(value: string | null | undefined) {
  if (value === 'whatsapp') return 'WhatsApp';
  if (value === 'phone') return 'Telefone';
  if (value === 'email') return 'E-mail';
  if (value === 'sms') return 'SMS';
  if (value === 'in_person') return 'Presencial';
  return value ?? '—';
}

export function feedbackCaseEventLabel(value: string | null | undefined) {
  if (value === 'case.created_by_rule') return 'Ocorrência criada (automático)';
  if (value === 'case.created_manual') return 'Ocorrência criada (manual)';
  if (value === 'case.status_changed') return 'Status alterado';
  if (value === 'case.priority_changed') return 'Prioridade alterada';
  if (value === 'case.assignee_changed') return 'Responsável alterado';
  if (value === 'case.assigned_to_me') return 'Atribuída a mim';
  if (value === 'case.due_changed') return 'Vencimento alterado';
  if (value === 'case.contact_logged') return 'Contato registrado';
  return value ?? '—';
}

export function whistleblowerCategoryLabel(value: string | null | undefined) {
  if (value === 'moral_harassment') return 'Assédio moral';
  if (value === 'sexual_harassment') return 'Assédio sexual';
  if (value === 'discrimination') return 'Discriminação';
  if (value === 'racism') return 'Racismo';
  if (value === 'racial_injury') return 'Injúria racial';
  if (value === 'homophobia') return 'Homofobia';
  if (value === 'transphobia') return 'Transfobia';
  if (value === 'religious_intolerance') return 'Intolerância religiosa';
  if (value === 'fraud') return 'Fraude';
  if (value === 'corruption') return 'Corrupção';
  if (value === 'conflict_of_interest') return 'Conflito de interesses';
  if (value === 'policy_violation') return 'Violação de políticas internas';
  if (value === 'work_safety') return 'Segurança do trabalho';
  if (value === 'lgpd_privacy') return 'LGPD / privacidade';
  if (value === 'misconduct') return 'Conduta inadequada';
  if (value === 'other') return 'Outro';
  return value ?? '—';
}

export function whistleblowerStatusLabel(value: string | null | undefined) {
  if (value === 'received') return 'Recebida';
  if (value === 'analyzing') return 'Em análise';
  if (value === 'investigating') return 'Em investigação';
  if (value === 'awaiting_info') return 'Aguardando informações';
  if (value === 'completed') return 'Concluída';
  if (value === 'archived') return 'Arquivada';
  return value ?? '—';
}

export function whistleblowerStatusClass(value: string | null | undefined) {
  if (value === 'received') return 'bg-sky-100 text-sky-700';
  if (value === 'analyzing') return 'bg-indigo-100 text-indigo-700';
  if (value === 'investigating') return 'bg-amber-100 text-amber-700';
  if (value === 'awaiting_info') return 'bg-yellow-100 text-yellow-700';
  if (value === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (value === 'archived') return 'bg-slate-100 text-slate-700';
  return 'bg-slate-100 text-slate-700';
}

export function whistleblowerPriorityLabel(value: string | null | undefined) {
  if (value === 'low') return 'Baixa';
  if (value === 'medium') return 'Média';
  if (value === 'high') return 'Alta';
  if (value === 'critical') return 'Crítica';
  return value ?? '—';
}

export function whistleblowerPriorityClass(value: string | null | undefined) {
  if (value === 'low') return 'bg-slate-100 text-slate-700';
  if (value === 'medium') return 'bg-indigo-100 text-indigo-700';
  if (value === 'high') return 'bg-amber-100 text-amber-700';
  if (value === 'critical') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

export function whistleblowerEventLabel(value: string | null | undefined) {
  if (value === 'report.submitted') return 'Denúncia recebida';
  if (value === 'status_changed') return 'Status alterado';
  if (value === 'priority_changed') return 'Prioridade alterada';
  if (value === 'assignee_changed') return 'Responsável alterado';
  if (value === 'notes') return 'Anotação interna';
  if (value === 'comment') return 'Comentário';
  return value ?? '—';
}

