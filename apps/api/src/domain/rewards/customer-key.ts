import { normalizeBrDocument } from '../../common/br-document';

export type CustomerKeyKind = 'phone' | 'cpf';

export type ResolvedCustomerKey = {
  kind: CustomerKeyKind;
  value: string;
  key: string;
};

export type CustomerKeyInput = {
  phone?: string | null;
  document?: string | null;
};

export function normalizeRewardPhone(phone?: string | null): string | null {
  if (typeof phone !== 'string') return null;
  let digits = phone.replace(/\D+/g, '');
  if (!digits) return null;
  digits = digits.replace(/^0+/, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  if (digits.length < 12 || digits.length > 15) return null;
  return digits;
}

export function normalizeRewardCpf(document?: string | null): string | null {
  const parsed = normalizeBrDocument(document);
  if (!parsed || parsed.type !== 'cpf') return null;
  return parsed.value;
}

export function resolveCustomerKey(
  input: CustomerKeyInput,
): ResolvedCustomerKey | null {
  const phone = normalizeRewardPhone(input.phone);
  if (phone) return { kind: 'phone', value: phone, key: `phone:${phone}` };

  const cpf = normalizeRewardCpf(input.document);
  if (cpf) return { kind: 'cpf', value: cpf, key: `cpf:${cpf}` };

  return null;
}
