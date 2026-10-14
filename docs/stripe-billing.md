# Cobrança self-serve com Stripe

Tenants com `billingMode = stripe` assinam pelo Stripe Checkout e gerenciam a
assinatura (cartão, cancelamento, faturas) pelo Customer Portal. Tenants
`manual` (DevMais) nunca são afetados: não veem "assine", não podem abrir
checkout e o webhook não altera o estado deles.

## Fluxo

1. Cadastro (`POST /onboarding/tenant`) grava o plano escolhido (`planSlug`) e
   inicia o trial interno (`Plan.trialDays`, padrão 14 dias). Nenhum cartão.
2. "Assinar" (`POST /billing/checkout`) cria o cliente na Stripe (uma vez por
   tenant) e uma Checkout Session de assinatura com o `Plan.stripePriceId`.
   Se ainda restam mais de 48h de trial, a assinatura nasce em `trialing` até
   o fim do trial interno — o cliente não perde dias de teste.
3. A Stripe devolve para `/app/company?billing=success&session_id=...`; o front
   chama `POST /billing/checkout/sync` para refletir na hora.
4. O webhook (`POST /billing/webhook`) é a fonte da verdade. A cada evento a API
   busca a assinatura atualizada na Stripe e grava no tenant.

| Assinatura na Stripe | Tenant |
| --- | --- |
| `trialing` | `trial` (`trialEndsAt` = fim do trial) |
| `active` | `active` |
| `past_due` | `delinquent` — mantém acesso, banner pede atualizar pagamento |
| `unpaid`, `paused` | `suspended` |
| `canceled`, `incomplete_expired` | `cancelled` |
| `incomplete` | status não muda |

## Bloqueio de acesso

Com `BILLING_ENFORCEMENT=true`, usuários de tenants Stripe com trial vencido,
assinatura cancelada ou suspensa recebem `402 billing_required` em todas as
rotas autenticadas, exceto `/auth/*`, `GET /tenant/me` e `/billing/*`. O painel
mostra a tela "Assinar agora". Rotas públicas (pesquisas, canal ético) seguem
funcionando. Contas manuais e a conta da plataforma nunca são bloqueadas.

> Antes de ligar em produção, confira tenants Stripe com trial já vencido —
> eles perdem o acesso no mesmo instante:
>
> ```sql
> select slug, status, "trialEndsAt" from tenants
> where "billingMode" = 'stripe' and "isPlatform" = false
>   and status = 'trial' and "trialEndsAt" < now();
> ```
>
> Estenda o trial pelo admin ou mude para manual quem não deve ser bloqueado.

## Configuração

Variáveis da API:

| Variável | Valor |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` (teste) / `sk_live_...` ou chave restrita `rk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` do endpoint de webhook |
| `BILLING_ENFORCEMENT` | `false` até validar; `true` para bloquear |

No painel da Stripe:

1. **Produtos**: um produto por plano, com preço recorrente mensal em BRL.
   Copie o `price_...` para o campo *Stripe Price ID* do plano em `/admin/plans`.
   Plano sem price não pode ser assinado online.
2. **Webhook**: endpoint `https://opiina.com/api/billing/webhook` com os eventos
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.paused`, `customer.subscription.resumed`,
   `invoice.paid`, `invoice.payment_failed`.
3. **Customer Portal** (Settings → Billing → Customer portal): ative e salve a
   configuração; sem isso `POST /billing/portal` falha.
4. **Retentativas** (Settings → Billing → Subscriptions and emails): defina o
   que fazer após as tentativas falharem (marcar `unpaid` ou cancelar).

Chaves de teste e de produção têm produtos, preços, clientes e webhooks
separados: ao trocar para produção, recadastre os `price_...` live nos planos.

## Teste em modo de teste

```bash
stripe login
stripe listen --forward-to localhost:3000/billing/webhook
```

Use o `whsec_...` que o `stripe listen` imprime como `STRIPE_WEBHOOK_SECRET`.

Roteiro:

- [ ] Cadastrar empresa escolhendo um plano → `/app/company` mostra o plano e o trial.
- [ ] Assinar com `4242 4242 4242 4242` → volta com "Assinatura confirmada";
      tenant fica `trial` (assinatura `trialing`) ou `active` se o trial já acabou.
- [ ] Cartão recusado `4000 0000 0000 0002` → checkout mostra erro, tenant não muda.
- [ ] 3DS `4000 0027 6000 3184` → autenticar e concluir.
- [ ] "Gerenciar assinatura" abre o portal; cancelar → banner "cancelamento agendado".
- [ ] `stripe trigger invoice.payment_failed` → tenant `delinquent`, banner amarelo.
- [ ] Cancelar a assinatura imediatamente no dashboard → tenant `cancelled`;
      com `BILLING_ENFORCEMENT=true` o painel mostra a tela de bloqueio.
- [ ] Reenviar o mesmo evento (`stripe events resend evt_...`) → resposta `duplicate`.
- [ ] Conta manual: não vê banner nem botão de assinar.

Para simular o fim do trial sem esperar, use um
[test clock](https://docs.stripe.com/billing/testing/test-clocks) ou ajuste
`trialEndsAt` no banco de teste.
