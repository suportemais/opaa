import {
  buildRewardDeepLink,
  formatRewardAmountBrl,
  formatRewardAmountDecimal,
} from './code';
import {
  DEFAULT_REWARD_WHATSAPP_TEMPLATE,
  renderRewardWhatsappMessage,
} from './whatsapp-message';

describe('reward WhatsApp message', () => {
  it('renders the default template with deep link /app?voucher=CODE', () => {
    const link = buildRewardDeepLink({
      appBaseUrl: 'https://app.muitomais.example',
      code: 'MMABC12D',
    });
    expect(link).toBe('https://app.muitomais.example/app?voucher=MMABC12D');
    expect(formatRewardAmountDecimal(1500)).toBe('15.00');
    expect(formatRewardAmountBrl(1500)).toBe('R$ 15,00');
    expect(
      renderRewardWhatsappMessage(null, {
        code: 'MMABC12D',
        link,
        amountCents: 1500,
      }),
    ).toBe(
      'Você ganhou R$ 15,00 no Muito Mais. Código: MMABC12D. Resgate: https://app.muitomais.example/app?voucher=MMABC12D',
    );
    expect(DEFAULT_REWARD_WHATSAPP_TEMPLATE).toContain('{{code}}');
  });

  it('uses a campaign template when provided', () => {
    expect(
      renderRewardWhatsappMessage('Use {{code}} em {{link}} ({{amount}})', {
        code: 'X1',
        link: '/app?voucher=X1',
        amountCents: 200,
      }),
    ).toBe('Use X1 em /app?voucher=X1 (R$ 2,00)');
  });
});
