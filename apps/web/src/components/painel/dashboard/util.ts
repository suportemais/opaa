// Utilidades compartilhadas pelo Dashboard e pelo Ranking (formatos, datas, categorias de nota).

export const numero = (n: number) => n.toLocaleString('pt-BR');

export function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Data ISO (yyyy-mm-dd) deslocada `dias` a partir de outra data ISO. */
export function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return toIsoDate(d);
}

/** Dias entre duas datas ISO (b − a). */
export function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export const dataCurta = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export const dataLonga = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** Nota NPS (1–10) → categoria usada nas classes do painel. */
export function categoriaNota(nota: number | null | undefined): 'promotor' | 'passivo' | 'detrator' | null {
  if (typeof nota !== 'number') return null;
  if (nota <= 6) return 'detrator';
  if (nota <= 8) return 'passivo';
  return 'promotor';
}

/** Zonas do NPS mais usadas no Brasil (mesmas do protótipo). */
export function zonaNps(v: number) {
  if (v >= 75) return 'excelencia';
  if (v >= 50) return 'qualidade';
  if (v >= 0) return 'aperfeicoamento';
  return 'critica';
}

/** Percentuais inteiros de promotores/passivos/detratores que somam 100. */
export function percentuaisNps(c: { total: number; promoters: number; passives: number; detractors: number }) {
  if (!c.total) return { promotores: 0, passivos: 0, detratores: 0 };
  const promotores = Math.round((c.promoters / c.total) * 100);
  const detratores = Math.round((c.detractors / c.total) * 100);
  return { promotores, detratores, passivos: Math.max(0, 100 - promotores - detratores) };
}

export function npsDe(c: { total: number; promoters: number; detractors: number }) {
  if (!c.total) return null;
  return Math.round(((c.promoters - c.detractors) / c.total) * 100);
}

export function textoVariacao(v: number) {
  return v === 0 ? 'estável' : `${v > 0 ? '▲ +' : '▼ '}${v}`;
}

export const classeVariacao = (v: number) => (v > 0 ? 'sobe' : v < 0 ? 'desce' : '');

export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function nomeMes(ym: string) {
  const [year, month] = ym.split('-').map(Number);
  if (!year || !month) return ym;
  return `${MESES_CURTOS[month - 1]}/${String(year).slice(-2)}`;
}

/** Situação do prazo de um caso, no mesmo texto do protótipo. */
export function prazoInfo(dueAt: string | null | undefined): { texto: string; classe: string } {
  if (!dueAt) return { texto: 'Sem prazo', classe: '' };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const due = new Date(dueAt);
  due.setHours(0, 0, 0, 0);
  const dias = Math.round((due.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return { texto: `Venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, classe: 'prazo--vencido' };
  if (dias === 0) return { texto: 'Vence hoje', classe: 'prazo--hoje' };
  if (dias === 1) return { texto: 'Vence amanhã', classe: '' };
  return { texto: `Vence em ${due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`, classe: '' };
}
