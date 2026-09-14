import { formatRewardAmountBrl } from './code';

export const DEFAULT_REWARD_WHATSAPP_TEMPLATE =
  'Você ganhou {{amount}} no Muito Mais. Código: {{code}}. Resgate: {{link}}';

export function renderRewardWhatsappMessage(
  template: string | null | undefined,
  vars: { code: string; link: string; amountCents: number },
): string {
  const src = typeof template === 'string' && template.trim() ? template : DEFAULT_REWARD_WHATSAPP_TEMPLATE;
  return src
    .split('{{code}}')
    .join(vars.code)
    .split('{{link}}')
    .join(vars.link)
    .split('{{amount}}')
    .join(formatRewardAmountBrl(vars.amountCents));
}
