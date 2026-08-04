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

