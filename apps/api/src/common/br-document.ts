export type BrDocument = { type: 'cpf' | 'cnpj'; value: string };

function digitsOnly(value: string) {
  return value.replace(/\D+/g, '');
}

function isValidCpfDigits(value: string) {
  if (value.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(value)) return false;
  const nums = value.split('').map((c) => Number(c));
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += nums[i] * (len + 1 - i);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(9);
  const d2 = (() => {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += nums[i] * (11 - i);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  })();
  return nums[9] === d1 && nums[10] === d2;
}

function isValidCnpjDigits(value: string) {
  if (value.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(value)) return false;
  const nums = value.split('').map((c) => Number(c));
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calc = (weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += nums[i] * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(weights1);
  const d2 = calc(weights2);
  return nums[12] === d1 && nums[13] === d2;
}

export function normalizeBrDocument(input: string | null | undefined): BrDocument | null {
  if (input === null || input === undefined) return null;
  const raw = input.trim();
  if (!raw) return null;
  const digits = digitsOnly(raw);
  if (digits.length === 11) {
    if (!isValidCpfDigits(digits)) return null;
    return { type: 'cpf', value: digits };
  }
  if (digits.length === 14) {
    if (!isValidCnpjDigits(digits)) return null;
    return { type: 'cnpj', value: digits };
  }
  return null;
}

