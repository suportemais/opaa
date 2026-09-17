import { randomInt } from 'crypto';

export const MM_ADHESION_VOUCHER_DIGITS = 7;
export const MM_ADHESION_VOUCHER_MODULUS = 10 ** MM_ADHESION_VOUCHER_DIGITS;
export const MM_ADHESION_VOUCHER_MINT_ATTEMPTS = 12;

export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '');
}

/** Accepts `1234567` or formatted `1.234.567` / `123-4567`. */
export function normalizeAdhesionVoucher(
  input: string | null | undefined,
): string | null {
  if (input === null || input === undefined) return null;
  const digits = digitsOnly(String(input));
  if (digits.length !== MM_ADHESION_VOUCHER_DIGITS) return null;
  return digits;
}

export function generateAdhesionVoucherCode(): string {
  return String(randomInt(0, MM_ADHESION_VOUCHER_MODULUS)).padStart(
    MM_ADHESION_VOUCHER_DIGITS,
    '0',
  );
}

export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}
