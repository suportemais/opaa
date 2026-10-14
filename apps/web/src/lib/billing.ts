import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, apiFetch } from './api';

const ERROR_MESSAGES: Record<string, string> = {
  plan_required: 'Escolha um plano para assinar.',
  plan_inactive: 'Este plano não está mais disponível. Escolha outro.',
  plan_not_billable: 'Este plano ainda não está liberado para assinatura online. Fale com o suporte.',
  subscription_exists: 'Sua empresa já tem uma assinatura. Use "Gerenciar assinatura".',
  manual_billing: 'A cobrança da sua empresa é feita diretamente pela equipe Dev+.',
  no_stripe_customer: 'Ainda não há assinatura para gerenciar.',
  stripe_not_configured: 'A cobrança online está temporariamente indisponível.',
  stripe_error: 'Não foi possível falar com o sistema de pagamento. Tente novamente em instantes.',
};

export function billingErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.body && typeof err.body === 'object') {
    const code = (err.body as { message?: unknown }).message;
    if (typeof code === 'string' && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  }
  return 'Não foi possível abrir o pagamento. Tente novamente.';
}

/** Abre o Checkout (assinar) ou o Portal (gerenciar) da Stripe. */
export function useBillingRedirect() {
  const checkout = useMutation({
    mutationFn: (planSlug?: string) =>
      apiFetch<{ url: string }>('/billing/checkout', { method: 'POST', json: planSlug ? { planSlug } : {} }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const portal = useMutation({
    mutationFn: () => apiFetch<{ url: string }>('/billing/portal', { method: 'POST' }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const error = checkout.error ?? portal.error;
  return {
    startCheckout: (planSlug?: string) => checkout.mutate(planSlug),
    openPortal: () => portal.mutate(),
    pending: checkout.isPending || portal.isPending,
    error: error ? billingErrorMessage(error) : null,
  };
}

export type BillingReturnNotice = { kind: 'success' | 'cancelled' | 'pending'; text: string } | null;

/**
 * Trata o retorno do Checkout (?billing=success&session_id=...): sincroniza a
 * assinatura na hora e limpa a URL. O webhook continua sendo a fonte da verdade.
 */
export function useBillingReturn(): [BillingReturnNotice, () => void] {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<BillingReturnNotice>(null);
  const billing = params.get('billing');
  const sessionId = params.get('session_id');

  useEffect(() => {
    if (!billing) return;
    const clear = () => {
      const next = new URLSearchParams(params);
      next.delete('billing');
      next.delete('session_id');
      setParams(next, { replace: true });
    };

    if (billing === 'cancelled') {
      setNotice({ kind: 'cancelled', text: 'Pagamento não concluído. Você pode assinar quando quiser.' });
      clear();
      return;
    }
    if (billing !== 'success') return clear();

    setNotice({ kind: 'pending', text: 'Confirmando sua assinatura…' });
    const sync = sessionId
      ? apiFetch('/billing/checkout/sync', { method: 'POST', json: { sessionId } })
      : Promise.resolve();
    sync
      .then(() => setNotice({ kind: 'success', text: 'Assinatura confirmada. Obrigado!' }))
      .catch(() =>
        setNotice({
          kind: 'success',
          text: 'Pagamento recebido. A confirmação pode levar alguns instantes para aparecer.',
        }),
      )
      .finally(() => {
        qc.invalidateQueries({ queryKey: ['tenantMe'] });
        clear();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billing, sessionId]);

  return [notice, () => setNotice(null)];
}
