# OPIINA → Muito Mais adhesion voucher (v1)

Natural multi-tenant adhesion: **OPIINA mints a 7-digit one-time voucher bound to one unit CNPJ**, the customer enters it in **Muito Mais (signup or already logged in)**, MM calls this API to **resolve the issuer by that unit CNPJ**, then **consumes** the code after a successful bind/credit.

This path **does not use a tenant API key**. Integrações + Prêmios (`OPIINA_REWARD` / `MM_REWARD_*` HMAC verify) stay as they are. After this flow is in production, the API-key link becomes optional/legacy.

## Why a new table (not Coupon)

Survey `Coupon` / `CouponCampaign` codes are alphanumeric, unique per tenant, tied to a campaign + `customerKey`, and redeemed as post-survey rewards (`/internal/mm/rewards/*`). Adhesion vouchers are **globally unique 7-digit** codes, attributed by a **unit CNPJ snapshot** (never the tenant/matriz document), one-use, and consumed by MM to bind a user to the matching establishment. Reusing Coupon would overload uniqueness, status, and the POS/reward redeem model. Prêmios campaigns do **not** mint `MmAdhesionVoucher` — they still emit `Coupon` codes.

## Product rules

- Customer entry: **signup AND logged-in** (MM UI — follow-up repo).
- **1 voucher → 1 unidade (CNPJ)** fixed at mint. Never the tenant/matriz document.
- **1× use** only. `resolve` is a lookup; `consume` is the mark-used write.
- **Expiry** (default 30 days, 1–365).
- **Rate-limit** on resolve/consume (per IP and per code).
- 7 digits are OK with HMAC + expiry + rate-limit. If collisions become an issue, bump digits or go alphanumeric — do not sequential-issue.
- No unauthenticated public resolve (would enumerate a 7-digit space).
- No API key in customer admin for this path.

## OPIINA tenant emit (JWT)

Requires `tenant:settings:manage`. Issuer is the **unit CNPJ** (`Unidades` → CNPJ), snapshotted at mint with `unitId` + unit name. Tenant/matriz `Empresa` document is never used and never shown on emit. CPF or missing unit CNPJ is rejected (`issuer_cnpj_required`). Multi-unit tenants must send `unitId` (`unit_required`). A tenant with exactly one unit auto-selects it.

UI: **`/app/integracoes`** (card “Voucher Muito Mais”). Label `Unidade`. CNPJ line `{nome da unidade} · CNPJ {cnpj}`. Multi placeholder `Escolha a unidade antes de gerar`. Microcopy `O voucher vincula no Muito Mais pelo CNPJ desta unidade.` API key card is unchanged.

### `GET /mm-vouchers`

Last 50 vouchers for the tenant (includes the 7-digit code so the operator can share it).

### `POST /mm-vouchers`

```json
{
  "unitId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "amountCents": 1500,
  "validityDays": 30,
  "rules": { "kind": "wallet_credit" }
}
```

`unitId` is required when the tenant has more than one unit. Single-unit tenants may omit it (that unit is auto-selected). Missing `amountCents` / `rules` means **bind establishment only** (no credit). Default validity: `MM_VOUCHER_DEFAULT_VALIDITY_DAYS` (30).

Success (`201`/`200`):

```json
{
  "id": "…",
  "voucher": "1234567",
  "status": "unused",
  "unitId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "unitName": "Unidade Centro",
  "issuer": {
    "cnpj": "33000167000101",
    "legalName": "Centro Alimentos LTDA",
    "tradeName": "Unidade Centro"
  },
  "amountCents": 1500,
  "rules": { "kind": "wallet_credit" },
  "expiresAt": "2026-10-17T14:00:00.000Z",
  "usedAt": null,
  "usedByMmUserId": null,
  "usedByMmCompanyId": null,
  "createdAt": "2026-09-17T14:00:00.000Z"
}
```

### `POST /mm-vouchers/:id/cancel`

Cancels an unused code. Used/expired codes are not rewritten.

## MM server-to-server contract

Shared secret: **`MM_REWARD_HMAC_SECRET`** (same as reward verify). There is no per-tenant key on this path.

```
POST {OPIINA_API}/internal/mm/vouchers/resolve
POST {OPIINA_API}/internal/mm/vouchers/consume
```

HTTP **200** on both (including `{ ok: false }`). There is **no GET** (do not put the voucher in query strings).

### Request headers

| Header               | Value                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `X-MM-Timestamp`     | Unix seconds (or ms). Must be within `MM_REWARD_MAX_SKEW_SECONDS` (default 300). **Preferred.** |
| `X-MM-Signature`     | `sha256=<hex>` HMAC-SHA256 of `` `${timestamp}.${rawBody}` ``. **Preferred.**                   |
| `X-OPIINA-Timestamp` | Legacy alias of `X-MM-Timestamp`.                                                               |
| `X-OPIINA-Signature` | Legacy alias of `X-MM-Signature` (bare hex still accepted).                                     |
| `Content-Type`       | `application/json`                                                                              |

Sign the **exact raw JSON body** that you send. `sha256=` is stripped before compare; bare hex still works.

Signing string example:

```
1726332840.{"voucher":"1234567"}
```

```
X-MM-Timestamp: 1726332840
X-MM-Signature: sha256=<hex>
```

### Response headers

Every 200 JSON body is signed (same scheme as reward verify):

| Header               | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `X-Opiina-Timestamp` | Unix seconds when OPIINA signed the response                          |
| `X-Opiina-Signature` | `sha256=<hex>` HMAC-SHA256 of `` `${timestamp}.${rawResponseBody}` `` |

`rawResponseBody` is `JSON.stringify` of the response object.

Auth failures: `401` (`mm_reward_signature_required` / `mm_reward_timestamp_skew` / `mm_reward_signature_invalid` / `mm_voucher_required`). Secret missing: `503` (`mm_reward_hmac_not_configured`). Rate-limit: `429` (`mm_voucher_rate_limited`, `retryAfterSeconds`).

### `POST /internal/mm/vouchers/resolve`

Lookup only. Does **not** mark used.

```json
{ "voucher": "1234567" }
```

Digits only, or formatted (`123-4567`). Must be exactly 7 digits after stripping non-digits.

#### Success (`ok: true`)

```json
{
  "ok": true,
  "voucher": "1234567",
  "cnpj": "33000167000101",
  "legalName": "Centro Alimentos LTDA",
  "tradeName": "Unidade Centro",
  "unitId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "unitName": "Unidade Centro",
  "issuer": {
    "cnpj": "33000167000101",
    "legalName": "Centro Alimentos LTDA",
    "tradeName": "Unidade Centro"
  },
  "amountCents": 1500,
  "rules": { "kind": "wallet_credit" },
  "expiresAt": "2026-10-17T14:00:00.000Z",
  "status": "unused"
}
```

- `cnpj` is digits-only (14) and is the **unit CNPJ** snapshotted at mint. MM must resolve/create the **establishment/Company** by this CNPJ (never by OPIINA tenant id, never by tenant/matriz document).
- `unitId` / `unitName` are additive (may be `null` on vouchers minted before this change). Existing `cnpj` / `issuer` fields stay stable.
- `amountCents` / `rules` may be `null` (link only).
- `amountCents` is integer centavos. Credit via MM **wallet/ledger**, not the POS voucher spend model.

#### Failure (`ok: false`)

```json
{ "ok": false, "reason": "not_found" | "expired" | "used" | "cancelled" | "invalid_format" }
```

`used` may include `usedAt`. Unknown codes are `not_found` (no existence leak beyond HMAC + rate-limit).

### `POST /internal/mm/vouchers/consume`

Call **after** MM successfully binds the user and applies credit. One-use is enforced with a conditional update (`status=unused` AND `usedAt IS NULL` AND `expiresAt > now()`).

```json
{
  "voucher": "1234567",
  "mmUserId": "<MM User.id>",
  "mmCompanyId": "<MM Company.id>"
}
```

`mmUserId` and `mmCompanyId` are optional audit fields. Sign the exact body you send (including those keys when present).

#### Success

```json
{
  "ok": true,
  "voucher": "1234567",
  "status": "used",
  "usedAt": "2026-09-17T14:05:00.000Z",
  "cnpj": "33000167000101",
  "legalName": "Centro Alimentos LTDA",
  "tradeName": "Unidade Centro",
  "unitId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "unitName": "Unidade Centro",
  "issuer": {
    "cnpj": "33000167000101",
    "legalName": "Centro Alimentos LTDA",
    "tradeName": "Unidade Centro"
  },
  "amountCents": 1500,
  "rules": { "kind": "wallet_credit" },
  "expiresAt": "2026-10-17T14:00:00.000Z"
}
```

#### Failure

Same `reason` set as resolve. A retry after a successful consume returns `used` (not rewritten).

## Recommended MM flow

1. Customer enters 7 digits on **register** or a logged-in account screen.
2. MM backend `resolve`s (never from the browser to OPIINA).
3. Find or create the MM establishment/`Company` by `cnpj` (the OPIINA **unit** CNPJ). Bind the user to that establishment. Do not fall back to the tenant/matriz CNPJ.
4. If `amountCents` is a positive integer, credit the user wallet/ledger (idempotent on `voucher`). Do **not** treat this as a POS spend voucher.
5. `consume` with `mmUserId` + `mmCompanyId`.
6. Surface `expired` / `used` / `not_found` to the customer. On `429`, wait `retryAfterSeconds`.

Suggested TypeScript client sketch (MM repo):

```ts
async function opiinaVoucher(path: 'resolve' | 'consume', body: object) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const hex = hmacSha256Hex(process.env.MM_REWARD_HMAC_SECRET!, `${timestamp}.${rawBody}`);
  const res = await fetch(`${OPIINA_API}/internal/mm/vouchers/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MM-Timestamp': timestamp,
      'X-MM-Signature': `sha256=${hex}`,
    },
    body: rawBody,
  });
  if (res.status === 429) throw new Error('rate_limited');
  if (res.status !== 200) throw new Error(`opiina_${res.status}`);
  return res.json();
}
```

## Env

```
MM_REWARD_HMAC_SECRET=
MM_REWARD_MAX_SKEW_SECONDS=300
MM_VOUCHER_DEFAULT_VALIDITY_DAYS=30
MM_VOUCHER_RATE_LIMIT_PER_MINUTE=30
MM_VOUCHER_RATE_LIMIT_PER_CODE_PER_MINUTE=8
```

Rate-limit is in-process per API replica. HMAC remains the hard control against enumerating 10M codes.

## MM follow-up (muitomais)

This OPIINA PR does **not** change https://github.com/suportemais/muitomais. MM still needs:

1. Voucher field on **signup** and on a **logged-in** account screen (not signup-only).
2. Backend resolve → establishment/company-by-**unit** CNPJ (`cnpj` / `issuer.cnpj`) → bind user → wallet/ledger credit → consume. Do not map the code to a tenant/matriz CNPJ.
3. Reuse the existing HMAC helper (`opiina-reward.hmac.ts`) with `{ voucher }` bodies — do not invent a second secret.
4. Keep current Integrações API-key + `OPIINA_REWARD` verify/redeemed as-is.

## Coexistence

| Path                         | Purpose                         | Auth                         |
| ---------------------------- | ------------------------------- | ---------------------------- |
| `/integrations/mm`           | Optional/legacy API-key link    | Tenant JWT                   |
| `/coupon-campaigns` + emit   | Post-survey Prêmios             | Tenant JWT                   |
| `/internal/mm/rewards/*`     | Reward code verify / redeemed   | `MM_REWARD_*` HMAC           |
| `/mm-vouchers` + `/internal/mm/vouchers/*` | Adhesion voucher (this spec) | Tenant JWT / same HMAC |
