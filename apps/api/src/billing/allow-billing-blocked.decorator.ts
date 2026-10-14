import { SetMetadata } from '@nestjs/common';

export const ALLOW_BILLING_BLOCKED_KEY = 'allowBillingBlocked';

/** Rotas que continuam acessíveis quando o tenant perdeu acesso por cobrança. */
export const AllowBillingBlocked = () => SetMetadata(ALLOW_BILLING_BLOCKED_KEY, true);
