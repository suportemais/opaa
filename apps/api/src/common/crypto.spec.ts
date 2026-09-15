import { decryptSecret, encryptSecret, isEncryptedSecret } from './crypto';

describe('encryptSecret', () => {
  it('round-trips and never stores plaintext', () => {
    const secret = 'test-integrations-secret';
    const plaintext = 'mm-live-api-key-abc';
    const encrypted = encryptSecret(plaintext, secret);

    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain(plaintext);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(decryptSecret(encrypted, secret)).toBe(plaintext);
  });

  it('fails closed without a secret', () => {
    expect(() => encryptSecret('k', '')).toThrow('integrations_secret_missing');
  });
});
