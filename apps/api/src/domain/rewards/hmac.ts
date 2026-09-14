import { createHmac, timingSafeEqual } from 'crypto';

export type RewardSignedPayload = {
  amountCents: number;
  campaignId: string;
  code: string;
  customerKey: string;
  expiresAt: string | null;
  mmCompanyId: string;
};

export type VerifyRequestBody = {
  code: string;
  mmCompanyId?: string;
};

export function canonicalizeRewardPayload(
  payload: RewardSignedPayload,
): string {
  return JSON.stringify({
    amountCents: payload.amountCents,
    campaignId: payload.campaignId,
    code: payload.code,
    customerKey: payload.customerKey,
    expiresAt: payload.expiresAt,
    mmCompanyId: payload.mmCompanyId,
  });
}

export function canonicalizeVerifyRequest(body: VerifyRequestBody): string {
  const next: Record<string, string> = { code: body.code };
  if (typeof body.mmCompanyId === 'string' && body.mmCompanyId.trim()) {
    next.mmCompanyId = body.mmCompanyId.trim();
  }
  return JSON.stringify(next);
}

export function signHmacSha256Hex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** MM client sends `sha256=<hex>`; OPIINA v1 accepted bare hex. */
export function normalizeHmacSignature(signature: string): string {
  return signature
    .trim()
    .replace(/^sha256=/i, '')
    .trim();
}

export function formatHmacSignatureHeader(hex: string): string {
  return `sha256=${hex}`;
}

export function rawRequestBody(rawBody: unknown): string | undefined {
  if (typeof rawBody === 'string' && rawBody.length > 0) return rawBody;
  if (Buffer.isBuffer(rawBody) && rawBody.length > 0) {
    return rawBody.toString('utf8');
  }
  return undefined;
}

export function signTimestampedBody(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return signHmacSha256Hex(secret, `${timestamp}.${rawBody}`);
}

export function signOpiinaResponse(params: {
  timestamp: string;
  rawBody: string;
  secret: string;
}): { timestamp: string; signature: string } {
  return {
    timestamp: params.timestamp,
    signature: formatHmacSignatureHeader(
      signTimestampedBody(params.secret, params.timestamp, params.rawBody),
    ),
  };
}

export function signRewardPayload(
  payload: RewardSignedPayload,
  secret: string,
): string {
  return signHmacSha256Hex(secret, canonicalizeRewardPayload(payload));
}

export function verifyRewardSignature(
  payload: RewardSignedPayload,
  signature: string,
  secret: string,
): boolean {
  return timingSafeEqualHex(signRewardPayload(payload, secret), signature);
}

export function signVerifyRequest(params: {
  timestamp: string;
  body: VerifyRequestBody;
  secret: string;
}): string {
  const canonical = canonicalizeVerifyRequest(params.body);
  return signHmacSha256Hex(params.secret, `${params.timestamp}.${canonical}`);
}

export function verifyVerifyRequestSignature(params: {
  timestamp: string;
  body: VerifyRequestBody;
  signature: string;
  secret: string;
  rawBody?: string;
}): boolean {
  const normalized = normalizeHmacSignature(params.signature);
  const candidates: string[] = [];
  if (typeof params.rawBody === 'string' && params.rawBody.length > 0) {
    candidates.push(params.rawBody);
  }
  // MM client signs the exact compact JSON `{"code":"..."}`.
  const mmCompact = JSON.stringify({ code: params.body.code });
  const canonical = canonicalizeVerifyRequest(params.body);
  for (const payload of [mmCompact, canonical]) {
    if (!candidates.includes(payload)) candidates.push(payload);
  }
  return candidates.some((raw) =>
    timingSafeEqualHex(
      signTimestampedBody(params.secret, params.timestamp, raw),
      normalized,
    ),
  );
}

export function timingSafeEqualHex(expected: string, actual: string): boolean {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false;
  const a = expected.trim().toLowerCase();
  const b = actual.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

export function isTimestampFresh(
  timestamp: string,
  nowMs: number,
  maxSkewSeconds: number,
): boolean {
  if (!/^\d+$/.test(timestamp)) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const tsMs = timestamp.length <= 10 ? ts * 1000 : ts;
  return Math.abs(nowMs - tsMs) <= maxSkewSeconds * 1000;
}
