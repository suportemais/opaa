/** Finalidade do consentimento de ofertas/marketing em CustomerConsent.purpose. */
export const MARKETING_OFFERS_PURPOSE = 'marketing_offers';
export const MARKETING_OFFERS_TEXT_VERSION = 'v1';
export const MARKETING_OFFERS_TEXT =
  'Aceito receber ofertas, novidades e benefícios por e-mail, SMS ou WhatsApp.';

export type CustomerSource = 'survey' | 'import' | 'manual';
export const CUSTOMER_SOURCES: readonly CustomerSource[] = [
  'survey',
  'import',
  'manual',
];

function validYmd(y: number, m: number, d: number): Date | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d))
    return null;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  if (date.getTime() > Date.now()) return null;
  return date;
}

/**
 * Converte data de nascimento em Date UTC (meia-noite).
 * Aceita `aaaa-mm-dd` e `dd/mm/aaaa` (também `dd-mm-aaaa` / `dd.mm.aaaa`).
 * Retorna null se vazia ou inválida.
 */
export function parseBirthDate(raw: string | null | undefined): Date | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (m) return validYmd(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

/** "sim"/"não" (e variações) → boolean; vazio ou desconhecido → null. */
export function parseYesNo(raw: string | null | undefined): boolean | null {
  const value =
    typeof raw === 'string'
      ? raw.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
      : '';
  if (!value) return null;
  if (['sim', 's', 'yes', 'y', 'true', '1', 'x'].includes(value)) return true;
  if (['nao', 'n', 'no', 'false', '0'].includes(value)) return false;
  return null;
}

/** Dados de um novo registro em CustomerConsent para ofertas. */
export function marketingOffersConsentData(params: {
  tenantId: string;
  customerId: string;
  granted: boolean;
  source: CustomerSource;
  at?: Date;
}) {
  const at = params.at ?? new Date();
  return {
    tenantId: params.tenantId,
    customerId: params.customerId,
    purpose: MARKETING_OFFERS_PURPOSE,
    text: MARKETING_OFFERS_TEXT,
    textVersion: MARKETING_OFFERS_TEXT_VERSION,
    status: params.granted ? 'granted' : 'denied',
    grantedAt: at,
    source: params.source,
  };
}
