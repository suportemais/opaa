import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import { env } from '../lib/env';
import { setAccessToken, setTenantId } from '../lib/auth-store';
import { isPlatformOperator } from '../lib/billing-access';
import { trackMetaEvent } from '../lib/metaPixelEvents';
import { usePublicPlans } from '../components/site/site-utils';
import { CreditoDev, Marca, Selo, SpriteBrilho } from '../components/site/SiteBits';
import { RecuperarSenhaModal } from '../components/site/RecuperarSenhaModal';

type TenantOption = { tenantId: string; tenantSlug?: string | null; tradeName?: string | null; legalName?: string | null };

export function LoginPage() {
  const navigate = useNavigate();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const baseDomain = env.appBaseDomain;
  const isRootDomain = !!baseDomain && hostname === baseDomain;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantOptions, setTenantOptions] = useState<TenantOption[] | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [recuperacaoAberta, setRecuperacaoAberta] = useState(false);
  // Volta da Stripe logo depois do cadastro (?billing=success|cancelled); o webhook confirma a assinatura.
  const [searchParams] = useSearchParams();
  const retornoPagamento = searchParams.get('billing');
  usePixelInicioTeste(retornoPagamento === 'success', searchParams.get('plan'), searchParams.get('session_id'));

  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const esqueciRef = useRef<HTMLAnchorElement>(null);

  const emailInvalido = tentouEnviar && !isRootDomain && !/^\S+@\S+\.\S+$/.test(email);
  const senhaInvalida = tentouEnviar && !isRootDomain && !password;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isRootDomain) {
      setTentouEnviar(true);
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        emailRef.current?.focus();
        return;
      }
      if (!password) {
        senhaRef.current?.focus();
        return;
      }
    }

    setLoading(true);
    try {
      if (isRootDomain) {
        const slug = company.trim().toLowerCase();
        if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
          setError('Informe o subdomínio da empresa (ex.: minha-empresa).');
          return;
        }
        const protocol = window.location.protocol || 'https:';
        window.location.href = `${protocol}//${slug}.${baseDomain}/login`;
        return;
      }

      const result = await apiFetch<{ accessToken: string; tenantId: string; userId: string }>('/auth/login', {
        method: 'POST',
        json:
          tenantOptions && selectedTenantId
            ? { tenantId: selectedTenantId, email, password }
            : { email, password },
      });
      setAccessToken(result.accessToken);
      setTenantId(result.tenantId);
      const me = await apiFetch<{ permissionCodes: string[]; roleCodes?: string[] }>('/auth/me');
      navigate(isPlatformOperator(me) ? '/admin' : '/app');
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as any;
        const message = body?.message ?? body;
        if (err.status === 409 && message?.code === 'multiple_tenants' && Array.isArray(message?.tenants)) {
          setTenantOptions(message.tenants);
          setSelectedTenantId(message.tenants?.[0]?.tenantId ?? '');
          setError('Selecione a empresa para continuar.');
          return;
        }
        if (err.status === 401 && (message?.code === 'user_invited' || body?.code === 'user_invited')) {
          setError('Seu convite ainda não foi aceito. Abra o link enviado por e-mail para criar sua senha.');
          return;
        }
      }
      setError('Não foi possível autenticar. Verifique e-mail e senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="site pagina-login">
      <SpriteBrilho />

      <div className="login">
        {/* Painel da marca (desktop) */}
        <aside className="login__marca" aria-label="Sobre o Opiina">
          <Marca className="marca--clara" />

          <div className="login__marca-texto">
            <Selo claro />
            <p className="login__frase">
              O que o cliente sente. <span>O que a casa precisa fazer.</span>
            </p>
            <ul className="login__lista">
              <li>Pesquisa NPS rápida, em mais de um canal</li>
              <li>Dashboard e métricas por unidade</li>
              <li>Ocorrências organizadas no Kanban</li>
            </ul>
          </div>

          <CreditoDev />
        </aside>

        {/* Formulário */}
        <main className="login__principal" id="conteudo">
          <Marca className="login__marca-mobile" />

          <div className="login__cartao">
            <h1 className="login__titulo">Entrar</h1>
            <p className="login__sub">Acesse o painel</p>
            {retornoPagamento === 'success' && (
              <p className="formulario__aviso formulario__aviso--ok" role="status">
                Pagamento cadastrado. Entre com o e-mail e a senha que você criou.
              </p>
            )}
            {retornoPagamento === 'cancelled' && (
              <p className="formulario__aviso" role="status">
                Pagamento não concluído. Você pode assinar depois, pelo painel.
              </p>
            )}

            <form className="formulario" noValidate onSubmit={onSubmit}>
              {isRootDomain ? (
                <div className="campo">
                  <label htmlFor="empresa">Empresa</label>
                  <div className="campo__composto">
                    <input
                      id="empresa"
                      name="empresa"
                      type="text"
                      inputMode="url"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="minha-empresa"
                    />
                    <span className="campo__sufixo" aria-hidden="true">
                      .{baseDomain}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {tenantOptions && (
                    <div className="campo">
                      <label htmlFor="empresa">Empresa</label>
                      <select id="empresa" value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)}>
                        {tenantOptions.map((t) => (
                          <option key={t.tenantId} value={t.tenantId}>
                            {t.tradeName ?? t.legalName ?? t.tenantId}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="campo">
                    <label htmlFor="email">E-mail</label>
                    <input
                      ref={emailRef}
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      placeholder="email@empresa.com"
                      required
                      aria-invalid={emailInvalido}
                      aria-describedby="email-erro"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="campo__erro" id="email-erro" hidden={!emailInvalido}>
                      Informe um e-mail válido.
                    </p>
                  </div>

                  <div className="campo">
                    <div className="campo__topo">
                      <label htmlFor="senha">Senha</label>
                      <Link
                        ref={esqueciRef}
                        className="campo__link"
                        to="/forgot-password"
                        aria-haspopup="dialog"
                        onClick={(e) => {
                          // Com <dialog> disponível, abre o modal; senão segue para a página /forgot-password.
                          if (typeof HTMLDialogElement === 'undefined') return;
                          e.preventDefault();
                          setRecuperacaoAberta(true);
                        }}
                      >
                        Esqueci minha senha
                      </Link>
                    </div>
                    <input
                      ref={senhaRef}
                      id="senha"
                      name="senha"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      required
                      aria-invalid={senhaInvalida}
                      aria-describedby="senha-erro"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="campo__erro" id="senha-erro" hidden={!senhaInvalida}>
                      Informe sua senha.
                    </p>
                  </div>
                </>
              )}

              {error && (
                <p className="formulario__alerta" role="alert">
                  {error}
                </p>
              )}

              <button className="btn btn--solido btn--grande btn--largo" type="submit" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="login__novo">
              Novo por aqui? <Link to="/onboarding">Criar conta</Link>
            </p>
          </div>

          <CreditoDev mobile />
        </main>
      </div>

      {!isRootDomain && (
        <RecuperarSenhaModal
          aberto={recuperacaoAberta}
          emailInicial={/^\S+@\S+\.\S+$/.test(email) ? email : ''}
          onFechar={() => {
            setRecuperacaoAberta(false);
            esqueciRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/**
 * Conversão do Meta Pixel na volta da Stripe: o pagamento foi cadastrado e a assinatura começou. Espera os planos para mandar o valor; um evento por sessão do Checkout.
 */
function usePixelInicioTeste(ativo: boolean, planSlug: string | null, sessionId: string | null) {
  const { plans } = usePublicPlans();
  const enviado = useRef(false);

  useEffect(() => {
    if (!ativo || !plans || enviado.current) return;
    enviado.current = true;
    const chave = sessionId ? `opiina:pixel-start-trial:${sessionId}` : null;
    try {
      if (chave && sessionStorage.getItem(chave)) return;
      if (chave) sessionStorage.setItem(chave, '1');
    } catch {}
    const plan = plans.find((p) => p.slug === planSlug);
    const valor = plan ? { content_name: plan.name, value: plan.priceCents / 100, currency: plan.currency } : undefined;
    trackMetaEvent('StartTrial', valor, sessionId ?? undefined);
  }, [ativo, plans, planSlug, sessionId]);
}
