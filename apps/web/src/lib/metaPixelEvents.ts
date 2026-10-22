/**
 * Evento padrão do Pixel (CompleteRegistration, InitiateCheckout...). Sem Pixel carregado, não faz nada.
 * Com eventId, a Meta descarta repetições do mesmo evento (ex.: recarregar a página).
 */
export function trackMetaEvent(event: string, params?: Record<string, unknown>, eventId?: string) {
  window.fbq?.('track', event, params ?? {}, ...(eventId ? [{ eventID: eventId }] : []));
}
