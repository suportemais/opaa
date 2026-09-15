import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const SECRET_PREFIX = 'v1';

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

export function deriveAes256Key(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** AES-256-GCM. Stored form is `v1:<iv>:<tag>:<ciphertext>` (base64url). Never plaintext. */
export function encryptSecret(plaintext: string, secret: string): string {
  if (!secret.trim()) throw new Error('integrations_secret_missing');
  const key = deriveAes256Key(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    SECRET_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptSecret(payload: string, secret: string): string {
  if (!secret.trim()) throw new Error('integrations_secret_missing');
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== SECRET_PREFIX) {
    throw new Error('invalid_encrypted_secret');
  }
  const key = deriveAes256Key(secret);
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${SECRET_PREFIX}:`) && value.split(':').length === 4;
}
