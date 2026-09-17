# OPIINA → Muito Mais reward contract (v1)

Post-survey reward **emit** is owned by OPIINA. Muito Mais does not generate or store the source of truth for codes. MM validates a code with HMAC (local check of the signed payload) and/or a server-to-server verify call.

This file is **only** the survey `OPIINA_REWARD` / Coupon contract (`/internal/mm/rewards/*`). The 7-digit multi-tenant **adhesion voucher** is a separate table and API — see [mm-adhesion-voucher.md](./mm-adhesion-voucher.md). Do not reuse this redeem model for adhesion.

## Product rules

- One reward code per `(campaignId, customerKey)`. Extra survey responses for the same customer do not issue another code.
- `customerKey` prefers phone (WhatsApp + unique). CPF is used only when phone is absent.
- WhatsApp is sent by OPIINA via `WebhookOutbox` (`reward.whatsapp.send`).
- Deep link format (locked): **`/app?voucher=CODE`**.
  - Absolute URL: `{MM_APP_BASE_URL}/app?voucher={urlEncodedCode}`.
  - Alternative `/resgatar?code=CODE` is **not** used in v1.
- Not a fiscal coupon. No NFC-e. One MM company per network in v1 (`mmCompanyId` on the campaign).

## Campaign CRUD (OPIINA panel)

Tenant operators manage campaigns at **`/app/premios`** (API `/coupon-campaigns`). Pause instead of delete.

| Field                       | Notes                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| name                        | Required                                                                                        |
| surveyId                    | Eligible survey                                                                                 |
| startsAt / endsAt           | Optional window                                                                                 |
| rewardAmountCents           | Fixed BRL                                                                                       |
| mmCompanyId                 | Required. **Muito Mais `Company.id`** (never Establishment.id, OPIINA `Tenant.id`, or unit id). |
| perCustomerLimit            | Always `1` in v1                                                                                |
| status                      | `active` / `paused` (also `draft`)                                                              |
| message                     | WhatsApp template (`{{code}}`, `{{link}}`, `{{amount}}`)                                        |
| issuedCount / redeemedCount | Read-only KPIs                                                                                  |

`POST /coupon-campaigns` creates and activates by default (`activate: true`). `POST /coupon-campaigns/:id/pause` and `/activate` toggle status. Activating sets `surveys.enableCoupon = true`.

### Empresa Muito Mais (`mmCompanyId`)

`mmCompanyId` is **`Company.id` on Muito Mais**. It is not an establishment, OPIINA tenant, or unit.

`GET /mm-companies` (tenant JWT, `survey:read`) is the picker source for `/app/premios`:

- Label: MM company **trade name** (e.g. `Grupo Geppos — MM`)
- Value: `Company.id`
- Establishments (e.g. PRIMO JARDINS) are filtered out even if MM returns a mixed payload

Catalog source:

1. **Tenant link only** — company persisted by `POST /integrations/mm/connect` (tenant-admin API key). See [mm-tenant-integration.md](./mm-tenant-integration.md). Empty when the tenant is not connected.

The page must not fall back to OPIINA `tenant.tradeName` / `tenant.id` or `/units`.

## Campaign config (operator)

Extend existing `coupon_campaigns` (additive columns):

| Field               | Required when reward is on | Notes                                                                                                                                                           |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surveyId`          | yes                        | Eligible survey for emit                                                                                                                                        |
| `rewardEnabled`     | yes (`true`)               | Plus survey.`enableCoupon`                                                                                                                                      |
| `mmCompanyId`       | yes                        | Muito Mais **`Company.id`**. Operator picks the company trade name on `/app/premios` (e.g. Grupo Geppos). Establishments such as PRIMO JARDINS must not appear. |
| `rewardAmountCents` | yes                        | Fixed BRL amount in cents                                                                                                                                       |
| `validityDays`      | optional                   | `expiresAt = issuedAt + validityDays`; else campaign `endsAt`                                                                                                   |
| `status`            | `active`                   | Also honors `startsAt` / `endsAt`                                                                                                                               |
| `message`           | optional                   | WhatsApp template with `{{code}}`, `{{link}}`, `{{amount}}`                                                                                                     |
| `prefix`            | optional                   | Code prefix (default `MM`)                                                                                                                                      |
| `perCustomerLimit`  | existing                   | Unique `(campaignId, customerKey)` is the hard cap of 1                                                                                                         |

## Identity

Normalized `customerKey`:

- Phone: digits only, BR `55` prefix when 10/11 digits → `phone:5511988887777`
- CPF: valid 11-digit CPF → `cpf:39053344705`

Public submit accepts optional `customer.document` (CPF) in addition to name/email/phone.

## WhatsApp outbox

`eventType`: `reward.whatsapp.send`

```json
{
  "channel": "whatsapp",
  "to": "5511988887777",
  "text": "Você ganhou R$ 15,00 no Muito Mais. Código: MMABC12D. Resgate: https://app.example/app?voucher=MMABC12D",
  "code": "MMABC12D",
  "deepLink": "https://app.example/app?voucher=MMABC12D",
  "deepLinkPath": "/app?voucher=MMABC12D",
  "amountCents": 1500,
  "mmCompanyId": "mm-co-1",
  "campaignId": "…",
  "customerKey": "phone:5511988887777",
  "expiresAt": "2026-10-01T00:00:00.000Z",
  "surveyResponseId": "…",
  "couponId": "…",
  "signature": "hex hmac-sha256",
  "signedPayload": {
    "amountCents": 1500,
    "campaignId": "…",
    "code": "MMABC12D",
    "customerKey": "phone:5511988887777",
    "expiresAt": "2026-10-01T00:00:00.000Z",
    "mmCompanyId": "mm-co-1"
  }
}
```

If the customer is identified only by CPF, the code is still issued; WhatsApp is skipped (no destination).

## Verify API

Locked to the Muito Mais client (`opiina-reward.client.ts` / `opiina-reward.hmac.ts`). Shared secret: `MM_REWARD_HMAC_SECRET`.

```
POST /internal/mm/rewards/verify
GET  /internal/mm/rewards/verify?code=MMABC12D
```

MM calls **POST** with the exact JSON body `{"code":"..."}` and expects **HTTP 200** (not 201). GET remains available for the same code lookup.

### Request headers (inbound)

Prefer MM headers. Legacy OPIINA headers are still accepted.

| Header               | Value                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `X-MM-Timestamp`     | Unix seconds (or ms). Must be within `MM_REWARD_MAX_SKEW_SECONDS` (default 300). **Preferred.** |
| `X-MM-Signature`     | `sha256=<hex>` HMAC-SHA256 of `` `${timestamp}.${rawBody}` ``. **Preferred.**                   |
| `X-OPIINA-Timestamp` | Legacy alias of `X-MM-Timestamp`.                                                               |
| `X-OPIINA-Signature` | Legacy alias of `X-MM-Signature` (bare hex still accepted).                                     |
| `Content-Type`       | `application/json` (POST)                                                                       |

Signature is verified against the **raw request body string** when Nest captures it (`rawBody: true`). Fallbacks:

1. exact MM compact JSON `{"code":"..."}`
2. canonical `{"code":"...","mmCompanyId":"..."}` when `mmCompanyId` is present

`sha256=` prefix is stripped before compare; bare hex still works.

Signing string example (MM):

```
1726332840.{"code":"MMABC12D"}
```

Header example:

```
X-MM-Timestamp: 1726332840
X-MM-Signature: sha256=<hex>
```

### POST body

```json
{ "code": "MMABC12D" }
```

`mmCompanyId` is optional. When present, the code must belong to that company.

### Response headers (outbound)

Every 200 verify JSON body is signed so the MM client can check it:

| Header               | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `X-Opiina-Timestamp` | Unix seconds when OPIINA signed the response                          |
| `X-Opiina-Signature` | `sha256=<hex>` HMAC-SHA256 of `` `${timestamp}.${rawResponseBody}` `` |

`rawResponseBody` is the exact `JSON.stringify` of the response object.

### Success body (`valid: true`)

MM schema (required fields). Extra OPIINA fields are additive and kept for offline HMAC of `signedPayload`.

```json
{
  "valid": true,
  "amount": "15.00",
  "code": "MMABC12D",
  "amountCents": 1500,
  "mmCompanyId": "mm-co-1",
  "customerKey": "phone:5511988887777",
  "expiresAt": "2026-10-01T00:00:00.000Z",
  "campaignId": "…",
  "status": "sent",
  "signature": "hex hmac-sha256 of signedPayload",
  "signedPayload": {
    "amountCents": 1500,
    "campaignId": "…",
    "code": "MMABC12D",
    "customerKey": "phone:5511988887777",
    "expiresAt": "2026-10-01T00:00:00.000Z",
    "mmCompanyId": "mm-co-1"
  }
}
```

- `amount` is a decimal string with 2 places (`1500` cents → `"15.00"`).
- `expiresAt` is ISO-8601 (or `null` when the campaign has no expiry).
- Body `signature` = hex HMAC-SHA256 of the canonical `signedPayload` JSON (keys in the order above) using `MM_REWARD_HMAC_SECRET`. Separate from the `X-Opiina-Signature` response header.

### Failure body (`valid: false`)

Auth succeeded, code not redeemable:

```json
{ "valid": false, "reason": "not_found" | "expired" | "cancelled" | "redeemed" | "company_mismatch" }
```

Auth failures: `401` (`mm_reward_signature_required` / `mm_reward_timestamp_skew` / `mm_reward_signature_invalid`). Secret missing: `503` (`mm_reward_hmac_not_configured`).

## Redeemed callback (MM → OPIINA)

When MM redeems a code, it notifies OPIINA so `coupons.redeemedAt` / `status=redeemed` and the campaign **Resgatados** KPI stay in sync. HMAC is the same as verify.

```
POST /internal/mm/rewards/redeemed
```

Headers and signing are identical to verify (`X-MM-Timestamp` + `X-MM-Signature: sha256=<hex>` over `` `${timestamp}.${rawBody}` ``). HTTP **200**. Response is signed with `X-Opiina-*`.

### POST body

```json
{ "code": "MMABC12D" }
```

`mmCompanyId` is optional. When present, the code must belong to that **Company.id**.

### Success

```json
{
  "ok": true,
  "code": "MMABC12D",
  "status": "redeemed",
  "redeemedAt": "2026-09-14T19:00:00.000Z",
  "amount": "15.00",
  "amountCents": 1500,
  "mmCompanyId": "mm-company-gepos",
  "customerKey": "phone:5511988887777",
  "campaignId": "…"
}
```

### Failure (`ok: false`)

```json
{ "ok": false, "reason": "not_found" | "expired" | "cancelled" | "redeemed" | "company_mismatch" }
```

Already-redeemed codes are not rewritten (`reason: "redeemed"`). MM follow-up PR should call this after a successful local redeem.

## Env

```
MM_REWARD_HMAC_SECRET=
MM_APP_BASE_URL=https://app.muitomais.example
MM_API_BASE_URL=https://muitomais.app/api
MM_COMPANIES_JSON=[{"id":"<Company.id>","tradeName":"Grupo Geppos"}]
MM_REWARD_MAX_SKEW_SECONDS=300
INTEGRATIONS_SECRET=
```
