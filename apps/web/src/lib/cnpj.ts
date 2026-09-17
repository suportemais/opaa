export function digitsOnly(value: string) {
  return value.replace(/\D+/g, '');
}

export function formatCnpj(input: string | null | undefined): string {
  const digits = input ? digitsOnly(input) : '';
  if (digits.length !== 14) return (input ?? '').trim();
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function unitCnpjLine(name: string, cnpj: string | null | undefined): string {
  const formatted = formatCnpj(cnpj);
  return `${name} · CNPJ ${formatted || '—'}`.trim();
}
