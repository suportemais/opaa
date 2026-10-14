import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import { env } from '../lib/env';
import { FALLBACK_PUBLIC_PLANS, formatPlanPrice, type PublicPlan } from '../lib/public-plans';
import { CreditoDev, Marca, Selo, SpriteBrilho } from '../components/site/SiteBits';
import { planoEmDestaque, usePublicPlans } from '../components/site/site-utils';

type Result = { tenantId: string; tenantSlug: string; adminUserId: string; unitId: string };

function slugify(value: string) {
  const raw = (value ?? '').trim();
  const ascii = raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const normalized = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.slice(0, 48);
}

/** Enquanto a pessoa digita: só minúsculas, números e hífen (o hífen final some ao sair do campo). */
function limparEndereco(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-/, '')
    .slice(0, 63);
}

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
// A API ainda recebe as cores do tenant; o cadastro novo não pede, então seguem os valores padrão.
const PRIMARY_COLOR = '#2563eb';
const SECONDARY_COLOR = '#0ea5e9';

const FUSOS = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT−3)' },
  { value: 'America/Manaus', label: 'Amazonas (GMT−4)' },
  { value: 'America/Rio_Branco', label: 'Acre (GMT−5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT−2)' },
];

type Campo = 'plan' | 'legalName' | 'tradeName' | 'tenantSlug' | 'email' | 'adminName' | 'adminEmail' | 'adminPassword' | 'unitName';

// Ordem de foco quando há erro (a mesma do formulário).
const CAMPO_ID: Record<Campo, string> = {
  plan: 'plano-start',
  legalName: 'razao',
  tradeName: 'fantasia',
  tenantSlug: 'subdominio',
  email: 'email-empresa',
  adminName: 'admin-nome',
  adminEmail: 'admin-email',
  adminPassword: 'admin-senha',
  unitName: 'unidade-nome',
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const baseDomain = env.appBaseDomain ?? hostname;
  const { plans: plansFromApi } = usePublicPlans();
  const plans = plansFromApi ?? FALLBACK_PUBLIC_PLANS;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [tentouEnviar, setTentouEnviar] = useState(false);

  const [planSlug, setPlanSlug] = useState(searchParams.get('plan') ?? '');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantSlugTouched, setTenantSlugTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [segment, setSegment] = useState('restaurante');

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [unitName, setUnitName] = useState('Unidade 1');
  const [unitTimeZone, setUnitTimeZone] = useState('America/Sao_Paulo');

  const selectedPlan = plans.find((p) => p.slug === planSlug) ?? null;

  const erros: Partial<Record<Campo, string>> = {};
  if (!selectedPlan) erros.plan = 'Escolha um plano para continuar.';
  if (!legalName.trim()) erros.legalName = 'Informe a razão social.';
  if (!tradeName.trim()) erros.tradeName = 'Informe o nome fantasia.';
  if (tenantSlug && !SLUG_REGEX.test(tenantSlug)) erros.tenantSlug = 'Use letras minúsculas, números e hífen.';
  if (!EMAIL_REGEX.test(email)) erros.email = 'Informe um e-mail válido.';
  if (!adminName.trim()) erros.adminName = 'Informe o nome.';
  if (!EMAIL_REGEX.test(adminEmail)) erros.adminEmail = 'Informe um e-mail válido.';
  if (adminPassword.length < 8) erros.adminPassword = 'A senha precisa ter pelo menos 8 caracteres.';
  if (!unitName.trim()) erros.unitName = 'Informe o nome da unidade.';
  const erro = (campo: Campo) => (tentouEnviar ? erros[campo] : undefined);

  function escolherPlano(slug: string) {
    setPlanSlug(slug);
    // Mantém o endereço coerente com a escolha (recarregar não perde o plano).
    const next = new URLSearchParams(searchParams);
    next.set('plan', slug);
    setSearchParams(next, { replace: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTentouEnviar(true);
    const primeiroErro = (Object.keys(CAMPO_ID) as Campo[]).find((campo) => erros[campo]);
    if (primeiroErro) {
      const alvo =
        primeiroErro === 'plan'
          ? document.getElementById(`plano-${plans[0]?.slug}`)
          : document.getElementById(CAMPO_ID[primeiroErro]);
      if (primeiroErro === 'plan') document.getElementById('escolha-plano')?.scrollIntoView({ block: 'center' });
      alvo?.focus({ preventScroll: primeiroErro === 'plan' });
      return;
    }

    setLoading(true);
    try {
      const created = await apiFetch<Result>('/onboarding/tenant', {
        method: 'POST',
        json: {
          tenantSlug: tenantSlug || undefined,
          legalName,
          tradeName,
          email,
          phone: phone || undefined,
          segment: segment || undefined,
          primaryColor: PRIMARY_COLOR,
          secondaryColor: SECONDARY_COLOR,
          adminName,
          adminEmail,
          adminPassword,
          unitName,
          unitTimeZone,
          planSlug: selectedPlan?.slug,
        },
      });
      setResult(created);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          typeof err.body === 'object' && err.body && 'message' in err.body
            ? String((err.body as any).message)
            : typeof err.body === 'string'
              ? err.body
              : 'Falha na API';
        setError(`Não foi possível concluir o cadastro (${err.status}). ${msg}`);
      } else {
        setError('Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="site pagina-login pagina-onboarding">
      <SpriteBrilho />

      <div className="login">
        {/* Painel da marca + plano escolhido (desktop) */}
        <aside className="login__marca onb__marca" aria-label="Plano escolhido">
          <Marca className="marca--clara" />
          <div className="login__marca-texto">
            <Selo claro />
            <ResumoPlano plan={selectedPlan} mostrarTrocar={!result} />
          </div>
          <CreditoDev />
        </aside>

        {/* Formulário */}
        <main className="login__principal onb__principal" id="conteudo">
          <div className="onb__topo">
            <Marca className="login__marca-mobile" />
            <p className="onb__entrar">
              Já tem conta? <Link to="/login">Entrar</Link>
            </p>
          </div>

          {result ? (
            <div className="login__cartao onb__cartao">
              <h1 className="login__titulo">Conta criada</h1>
              <p className="login__sub">Acesse pelo endereço do painel da sua empresa.</p>
              <dl className="onb__resultado">
                <div>
                  <dt>Endereço do painel</dt>
                  <dd>
                    https://{result.tenantSlug}.{baseDomain}
                  </dd>
                </div>
                <div>
                  <dt>Administrador</dt>
                  <dd>{adminEmail}</dd>
                </div>
              </dl>
              <div className="onb__acoes">
                <button
                  className="btn btn--solido btn--grande"
                  type="button"
                  onClick={() => {
                    const protocol = window.location.protocol || 'https:';
                    window.location.href = `${protocol}//${result.tenantSlug}.${baseDomain}/login`;
                  }}
                >
                  Ir para login
                </button>
              </div>
            </div>
          ) : (
            <div className="login__cartao onb__cartao">
              <h1 className="login__titulo">Crie sua conta</h1>
              <p className="login__sub">
                Escolha o plano e cadastre a empresa, quem vai administrar o painel e a primeira unidade.
              </p>

              <form className="formulario onb__form" noValidate onSubmit={onSubmit}>
                {/* 1. Plano */}
                <fieldset className="grupo" id="escolha-plano" aria-describedby="plano-erro">
                  <legend className="grupo__titulo">
                    <span className="grupo__num" aria-hidden="true">
                      1
                    </span>
                    Plano
                  </legend>
                  <p className="grupo__sub">Escolha como você quer usar o Opiina.</p>

                  <div className="planos-escolha" data-invalido={erro('plan') ? 'true' : undefined}>
                    {plans.map((plan) => (
                      <label key={plan.slug} className="plano-opcao">
                        <input
                          type="radio"
                          name="plan"
                          id={`plano-${plan.slug}`}
                          value={plan.slug}
                          checked={planSlug === plan.slug}
                          onChange={() => escolherPlano(plan.slug)}
                        />
                        {planoEmDestaque(plan) && plan.badge && <span className="plano-opcao__selo">{plan.badge}</span>}
                        <span className="plano-opcao__nome">{plan.name}</span>
                        <span className="plano-opcao__preco">
                          {formatPlanPrice(plan.priceCents, plan.currency)}
                          <small>/mês</small>
                        </span>
                        <span className="plano-opcao__desc">{plan.summary}</span>
                      </label>
                    ))}
                  </div>
                  <ErroCampo id="plano-erro" mensagem={erro('plan')} />
                </fieldset>

                {/* 2. Empresa */}
                <fieldset className="grupo">
                  <legend className="grupo__titulo">
                    <span className="grupo__num" aria-hidden="true">
                      2
                    </span>
                    Empresa
                  </legend>
                  <p className="grupo__sub">Dados principais da empresa.</p>

                  <div className="campo">
                    <label htmlFor="razao">Razão social</label>
                    <input
                      id="razao"
                      name="razao_social"
                      type="text"
                      autoComplete="organization"
                      placeholder="Minha Empresa LTDA"
                      required
                      aria-invalid={!!erro('legalName')}
                      aria-describedby="razao-erro"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                    />
                    <ErroCampo id="razao-erro" mensagem={erro('legalName')} />
                  </div>

                  <div className="campo">
                    <label htmlFor="fantasia">Nome fantasia</label>
                    <input
                      id="fantasia"
                      name="nome_fantasia"
                      type="text"
                      placeholder="Minha Marca"
                      required
                      aria-invalid={!!erro('tradeName')}
                      aria-describedby="fantasia-erro"
                      value={tradeName}
                      onChange={(e) => {
                        const next = e.target.value;
                        setTradeName(next);
                        // Sugere o endereço a partir do nome fantasia até a pessoa editar o campo por conta própria.
                        if (!tenantSlugTouched) setTenantSlug(slugify(next));
                      }}
                    />
                    <ErroCampo id="fantasia-erro" mensagem={erro('tradeName')} />
                  </div>

                  <div className="campo">
                    <label htmlFor="subdominio">Endereço do painel</label>
                    <div className="campo__composto">
                      <input
                        id="subdominio"
                        name="subdominio"
                        type="text"
                        inputMode="url"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="minha-marca"
                        aria-invalid={!!erro('tenantSlug')}
                        aria-describedby="subdominio-dica subdominio-erro"
                        value={tenantSlug}
                        onChange={(e) => {
                          setTenantSlugTouched(e.target.value !== '');
                          setTenantSlug(limparEndereco(e.target.value));
                        }}
                        onBlur={() => setTenantSlug((v) => v.replace(/-+$/, ''))}
                      />
                      <span className="campo__sufixo" aria-hidden="true">
                        .{baseDomain}
                      </span>
                    </div>
                    <p className="campo__dica" id="subdominio-dica">
                      Seu painel ficará em{' '}
                      <strong>
                        {tenantSlug || 'minha-marca'}.{baseDomain}
                      </strong>
                    </p>
                    <ErroCampo id="subdominio-erro" mensagem={erro('tenantSlug')} />
                  </div>

                  <div className="campos-2">
                    <div className="campo">
                      <label htmlFor="email-empresa">E-mail</label>
                      <input
                        id="email-empresa"
                        name="email_empresa"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="contato@empresa.com"
                        required
                        aria-invalid={!!erro('email')}
                        aria-describedby="email-empresa-erro"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <ErroCampo id="email-empresa-erro" mensagem={erro('email')} />
                    </div>
                    <div className="campo">
                      <label htmlFor="telefone">Telefone</label>
                      <input
                        id="telefone"
                        name="telefone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(11) 90000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="campo">
                    <label htmlFor="segmento">Segmento</label>
                    <input
                      id="segmento"
                      name="segmento"
                      type="text"
                      value={segment}
                      onChange={(e) => setSegment(e.target.value)}
                    />
                  </div>
                </fieldset>

                {/* 3. Administrador */}
                <fieldset className="grupo">
                  <legend className="grupo__titulo">
                    <span className="grupo__num" aria-hidden="true">
                      3
                    </span>
                    Administrador
                  </legend>
                  <p className="grupo__sub">Quem vai acessar o painel primeiro.</p>

                  <div className="campos-2">
                    <div className="campo">
                      <label htmlFor="admin-nome">Nome</label>
                      <input
                        id="admin-nome"
                        name="admin_nome"
                        type="text"
                        autoComplete="name"
                        placeholder="Seu nome"
                        required
                        aria-invalid={!!erro('adminName')}
                        aria-describedby="admin-nome-erro"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                      />
                      <ErroCampo id="admin-nome-erro" mensagem={erro('adminName')} />
                    </div>
                    <div className="campo">
                      <label htmlFor="admin-email">E-mail</label>
                      <input
                        id="admin-email"
                        name="admin_email"
                        type="email"
                        inputMode="email"
                        autoComplete="username"
                        placeholder="voce@empresa.com"
                        required
                        aria-invalid={!!erro('adminEmail')}
                        aria-describedby="admin-email-erro"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                      />
                      <ErroCampo id="admin-email-erro" mensagem={erro('adminEmail')} />
                    </div>
                  </div>

                  <div className="campo">
                    <label htmlFor="admin-senha">Senha</label>
                    <input
                      id="admin-senha"
                      name="admin_senha"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Crie uma senha (mínimo 8 caracteres)"
                      required
                      minLength={8}
                      aria-invalid={!!erro('adminPassword')}
                      aria-describedby="admin-senha-erro"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                    <ErroCampo id="admin-senha-erro" mensagem={erro('adminPassword')} />
                  </div>
                </fieldset>

                {/* 4. Primeira unidade */}
                <fieldset className="grupo">
                  <legend className="grupo__titulo">
                    <span className="grupo__num" aria-hidden="true">
                      4
                    </span>
                    Primeira unidade
                  </legend>
                  <p className="grupo__sub">Base para permissões e relatórios.</p>

                  <div className="campos-2">
                    <div className="campo">
                      <label htmlFor="unidade-nome">Nome</label>
                      <input
                        id="unidade-nome"
                        name="unidade_nome"
                        type="text"
                        required
                        aria-invalid={!!erro('unitName')}
                        aria-describedby="unidade-nome-erro"
                        value={unitName}
                        onChange={(e) => setUnitName(e.target.value)}
                      />
                      <ErroCampo id="unidade-nome-erro" mensagem={erro('unitName')} />
                    </div>
                    <div className="campo">
                      <label htmlFor="fuso">Fuso horário</label>
                      <select
                        id="fuso"
                        name="fuso_horario"
                        value={unitTimeZone}
                        onChange={(e) => setUnitTimeZone(e.target.value)}
                      >
                        {FUSOS.map((fuso) => (
                          <option key={fuso.value} value={fuso.value}>
                            {fuso.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </fieldset>

                {error && (
                  <p className="formulario__alerta" role="alert">
                    {error}
                  </p>
                )}

                <div className="onb__acoes">
                  <button className="btn btn--contorno btn--grande" type="button" onClick={() => navigate('/login')}>
                    Cancelar
                  </button>
                  <button className="btn btn--solido btn--grande" type="submit" disabled={loading}>
                    {loading ? 'Criando...' : 'Criar conta'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <CreditoDev mobile />
        </main>
      </div>
    </div>
  );
}

function ErroCampo({ id, mensagem }: { id: string; mensagem?: string }) {
  return (
    <p className="campo__erro" id={id} hidden={!mensagem}>
      {mensagem}
    </p>
  );
}

/** Painel azul (desktop): mostra o plano marcado, com os itens, ou pede a escolha. */
function ResumoPlano({ plan, mostrarTrocar }: { plan: PublicPlan | null; mostrarTrocar: boolean }) {
  const trocar = mostrarTrocar ? (
    <a
      className="plano-resumo__trocar"
      href="#escolha-plano"
      onClick={(evento) => {
        evento.preventDefault();
        document.getElementById('escolha-plano')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const alvo =
          document.querySelector<HTMLInputElement>('#escolha-plano input:checked') ??
          document.querySelector<HTMLInputElement>('#escolha-plano input');
        alvo?.focus({ preventScroll: true });
      }}
    >
      {plan ? 'Trocar plano' : 'Escolher plano'}
    </a>
  ) : null;

  if (!plan) {
    return (
      <div className="plano-resumo plano-resumo--claro">
        <p className="plano-resumo__rotulo">Plano</p>
        <p className="plano-resumo__nome">Escolha seu plano</p>
        <p className="plano-resumo__desc">Start e Pro para uma unidade. Redes para todas as suas unidades.</p>
        {trocar}
      </div>
    );
  }

  return (
    <div className="plano-resumo plano-resumo--claro">
      <p className="plano-resumo__rotulo">Plano selecionado</p>
      <p className="plano-resumo__nome">{plan.name}</p>
      <p className="plano-resumo__preco">
        {formatPlanPrice(plan.priceCents, plan.currency)}
        <small>/mês</small>
      </p>
      <p className="plano-resumo__desc">{plan.summary}</p>
      <ul className="login__lista">
        {plan.features.map((feature, i) => (
          <li key={`${plan.slug}-${i}`}>{feature}</li>
        ))}
      </ul>
      {trocar}
    </div>
  );
}
