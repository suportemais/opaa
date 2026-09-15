# OPIINA ↔ Muito Mais tenant self-serve link

Tenant operators paste a Muito Mais API key on **`/app/integracoes`**. OPIINA validates it server-to-server, then stores **`tenantId ↔ mmCompanyId`** plus an **encrypted** copy of the key. Existing campaigns, coupons, and HMAC voucher verify (`MM_REWARD_*`) are unchanged. Disconnect removes only the link row.

## Product rules

- One MM company per OPIINA tenant.
- The `/app/premios` company dropdown uses **only the linked company**.
- `MM_COMPANIES_JSON` is an emergency fallback when the tenant is **not** connected. Prefer the link.
- The stored API key is never returned by the API or shown in the UI.
- Voucher HMAC (`MM_REWARD_HMAC_SECRET`, `/internal/mm/rewards/verify`, `/internal/mm/rewards/redeemed`) is independent of this tenant key.

## Tenant API (JWT)

All routes require `tenant:settings:manage`. Responses never include the secret.

### `GET /integrations/mm`

Connection status.

```json
{
  "connected": true,
  "mmCompanyId": "mm-company-gepos",
  "tradeName": "Grupo Geppos",
  "connectedAt": "2026-09-15T14:00:00.000Z"
}
```

When disconnected:

```json
{
  "connected": false,
  "mmCompanyId": null,
  "tradeName": null,
  "connectedAt": null
}
```

### `POST /integrations/mm/connect`

```json
{ "apiKey": "<MM tenant API key>" }
```

OPIINA calls Muito Mais (see below). On success it upserts the tenant link (`connectedAt` is refreshed) and returns the same status object as `GET`. Reconnect replaces the previous company and encrypted key.

### `DELETE /integrations/mm`

Removes the link for this tenant only. Coupon campaigns and issued codes stay. Returns the disconnected status object.

### `GET /mm-companies` (picker)

Unchanged auth (`survey:read`). When the tenant is connected, the list is **exactly one** row: `{ id: mmCompanyId, tradeName }`. When not connected, `MM_COMPANIES_JSON` is parsed if present.

Creating a campaign with a different `mmCompanyId` than the linked company is rejected (`mm_company_not_linked`). Pause/activate of existing campaigns is unaffected.

## MM validate-key (S2S)

MM PR adds this endpoint. OPIINA tests stub it until MM is merged.

```
POST {MM_API_BASE_URL}/internal/opiina/validate-key
```

Example base: `https://muitomais.app/api`.

### Request

```http
POST /internal/opiina/validate-key
Content-Type: application/json
X-Opiina-Timestamp: 1726332840
X-Opiina-Signature: sha256=<hex>
```

```json
{ "apiKey": "<MM tenant API key>" }
```

`X-Opiina-*` HMAC is sent when `MM_REWARD_HMAC_SECRET` is configured. Signing string: `` `${timestamp}.${rawBody}` `` (same scheme as reward verify). The tenant API key is the object being validated; HMAC only proves the caller is OPIINA.

### Success (`200`)

```json
{
  "ok": true,
  "mmCompanyId": "<Company.id>",
  "tradeName": "Grupo Geppos"
}
```

`mmCompanyId` is Muito Mais **`Company.id`** (never Establishment.id). Nested `{ "company": { "id", "tradeName" } }` is also accepted.

### Failure

- `401` / `403` / `404`, or `{ "ok": false, "reason": "invalid_key" }` → OPIINA `400 invalid_mm_api_key` (nothing persisted).
- Network / 5xx / unparseable success body → `502 mm_validate_unavailable` or `invalid_mm_validate_response`.
- Missing `MM_API_BASE_URL` → `503 mm_api_not_configured`.

## Persistence

Additive table `tenant_mm_integrations` (no DROP / DELETE / TRUNCATE of existing data):

| Column            | Notes                                              |
| ----------------- | -------------------------------------------------- |
| `tenantId`        | Unique. One link per tenant.                       |
| `mmCompanyId`     | Muito Mais `Company.id`.                           |
| `tradeName`       | Cached label for status + picker.                  |
| `apiKeyEncrypted` | AES-256-GCM `v1:<iv>:<tag>:<ciphertext>` (base64url). |
| `connectedAt`     | Last successful connect.                           |

Encryption key: `INTEGRATIONS_SECRET`, falling back to `JWT_ACCESS_SECRET`.

## Env

```
MM_API_BASE_URL=https://muitomais.app/api
INTEGRATIONS_SECRET=
MM_REWARD_HMAC_SECRET=
MM_COMPANIES_JSON=
```

`MM_REWARD_*` voucher HMAC is unchanged. `INTEGRATIONS_SECRET` should be a long random string in production; if empty, `JWT_ACCESS_SECRET` is reused so local/dev still encrypts at rest.
