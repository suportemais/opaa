export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function accountStatusLabel(status: string) {
  switch (status) {
    case 'trial':
      return 'Trial';
    case 'active':
      return 'Ativa';
    case 'suspended':
      return 'Suspensa';
    case 'delinquent':
      return 'Inadimplente';
    case 'cancelled':
      return 'Cancelada';
    default:
      return status;
  }
}

export function accountStatusClass(status: string) {
  switch (status) {
    case 'active':
      return 'bg-cyan-50 text-cyan-800 ring-cyan-200';
    case 'trial':
      return 'bg-violet-50 text-violet-800 ring-violet-200';
    case 'suspended':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'delinquent':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

export function grantReasonLabel(reason: string | null | undefined) {
  switch (reason) {
    case 'manual':
      return 'Manual';
    case 'cortesia':
      return 'Cortesia';
    case 'trial_grant':
      return 'Trial concedido';
    default:
      return '—';
  }
}
