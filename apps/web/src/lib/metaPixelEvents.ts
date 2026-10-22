/** Evento padrão do Pixel (CompleteRegistration, InitiateCheckout...). Sem Pixel carregado, não faz nada. */
export function trackMetaEvent(event: string, params?: Record<string, unknown>) {
  window.fbq?.('track', event, ...(params ? [params] : []));
}
