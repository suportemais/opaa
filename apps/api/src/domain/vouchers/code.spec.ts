import {
  generateAdhesionVoucherCode,
  MM_ADHESION_VOUCHER_DIGITS,
  normalizeAdhesionVoucher,
} from './code';

describe('adhesion voucher code', () => {
  it('normalizes 7 digits and rejects other lengths', () => {
    expect(normalizeAdhesionVoucher('1234567')).toBe('1234567');
    expect(normalizeAdhesionVoucher('123-4567')).toBe('1234567');
    expect(normalizeAdhesionVoucher(' 1.234.567 ')).toBe('1234567');
    expect(normalizeAdhesionVoucher('0000001')).toBe('0000001');
    expect(normalizeAdhesionVoucher('123456')).toBeNull();
    expect(normalizeAdhesionVoucher('12345678')).toBeNull();
    expect(normalizeAdhesionVoucher('abcdefg')).toBeNull();
    expect(normalizeAdhesionVoucher('')).toBeNull();
  });

  it('generates a cryptographically random 7-digit string', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const code = generateAdhesionVoucherCode();
      expect(code).toMatch(new RegExp(`^\\d{${MM_ADHESION_VOUCHER_DIGITS}}$`));
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});
