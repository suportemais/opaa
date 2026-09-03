import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { getAccessToken } from '../lib/auth-store';
import {
  PLAN_SECTION_SUBTITLE,
  PLAN_SECTION_TITLE,
  formatAnnualPriceLabel,
  formatPriceLabel,
  resolvePublicPlans,
  trialLabel,
  type PublicPlan,
} from '../lib/public-plans';

function Logo(props: { className?: string }) {
  return (
    <img
      src="/logo-opiina.png"
      alt="Opiina"
      className={props.className ?? 'h-12 drop-shadow'}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.src.endsWith('/logo.svg')) return;
        el.src = '/logo.svg';
      }}
    />
  );
}

function FeatureChip(props: { feature: PublicPlan['features'][number] }) {
  const isNps = props.feature.key === 'nps' || props.feature.label === 'Pesquisa NPS';
  return (
    <li className="flex flex-col gap-0.5">
      <div className="inline-flex items-center gap-2 text-sm text-slate-700">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 10.5 8.2 13.5 15 6.5" />
          </svg>
        </span>
        {props.feature.label}
      </div>
      {isNps && <div className="pl-7 text-xs text-slate-500">Wizard e multicanal</div>}
    </li>
  );
}

function PlanCard(props: { plan: PublicPlan }) {
  const { plan } = props;
  const cta = plan.ctaLabel?.trim() || 'Assinar';
  return (
    <article
      className={[
        'relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm',
        plan.featured ? 'border-sky-400 shadow-sky-100 ring-2 ring-sky-200' : 'border-slate-200',
      ].join(' ')}
    >
      {plan.badge && (
        <div
          className={[
            'mb-4 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold',
            plan.featured ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700',
          ].join(' ')}
        >
          {plan.badge}
        </div>
      )}

      <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
      {plan.shortDescription && <p className="mt-1 text-sm leading-relaxed text-slate-600">{plan.shortDescription}</p>}

      <div className="mt-5">
        <div className="text-3xl font-semibold tracking-tight text-slate-900">
          {formatPriceLabel(plan.amountCents, plan.currency)}
        </div>
        <div className="mt-1 text-sm font-medium text-sky-700">{trialLabel(plan.trialDays)}</div>
        {plan.annualAmountCents != null && (
          <div className="mt-1 text-xs text-slate-500">
            {formatAnnualPriceLabel(plan.annualAmountCents, plan.currency)}
          </div>
        )}
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {plan.features
          .filter((feature) => feature.included)
          .map((feature) => (
            <FeatureChip key={feature.key} feature={feature} />
          ))}
      </ul>

      <Link
        to={`/onboarding?plan=${encodeURIComponent(plan.slug)}`}
        className={[
          'mt-8 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition',
          plan.featured
            ? 'bg-sky-600 text-white hover:bg-sky-700'
            : 'bg-slate-900 text-white hover:bg-slate-800',
        ].join(' ')}
      >
        {cta}
      </Link>
    </article>
  );
}

export function LandingPage() {
  const signedIn = Boolean(getAccessToken());
  const plansQuery = useQuery({
    queryKey: ['publicPlans'],
    queryFn: () => apiFetch<PublicPlan[]>('/plans'),
    retry: 1,
  });

  const plans = resolvePublicPlans(plansQuery.data);

  return (
    <div className="min-h-full bg-white text-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-sky-50" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />

        <header className="relative border-b border-slate-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
            <Link to="/" className="inline-flex items-center">
              <Logo className="h-10 md:h-12" />
            </Link>
            <nav className="flex items-center gap-2 sm:gap-3">
              <a href="#planos" className="hidden rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 sm:inline-flex">
                Planos
              </a>
              {signedIn ? (
                <Link
                  to="/app"
                  className="inline-flex h-10 items-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-700"
                >
                  Ir para o app
                </Link>
              ) : (
                <>
                  <Link to="/login" className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Entrar
                  </Link>
                  <a
                    href="#planos"
                    className="inline-flex h-10 items-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-700"
                  >
                    Ver planos
                  </a>
                </>
              )}
            </nav>
          </div>
        </header>

        <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-14 md:px-8 md:py-20 lg:flex-row lg:items-center">
          <div className="flex-1">
            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
              Ouça. Entenda. Fidelize.
            </div>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">
              Transforme feedback em crescimento
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
              Capture NPS, identifique oportunidades e organize o atendimento em um fluxo operacional simples.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#planos"
                className="inline-flex h-11 items-center rounded-md bg-sky-600 px-5 text-sm font-medium text-white hover:bg-sky-700"
              >
                Ver planos
              </a>
              <Link
                to="/onboarding"
                className="inline-flex h-11 items-center rounded-md border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Criar conta
              </Link>
            </div>
          </div>

          <div className="grid flex-1 gap-3 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">Pesquisa rápida (wizard) e multicanal</div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">Dashboard e métricas por unidade</div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">CRM e gestão de ocorrências (Kanban)</div>
          </div>
        </section>
      </div>

      <section id="planos" className="scroll-mt-8 bg-slate-50 py-16 md:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{PLAN_SECTION_TITLE}</h2>
            <p className="mt-3 text-base text-slate-600 md:text-lg">{PLAN_SECTION_SUBTITLE}</p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} />
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        Desenvolvido por{' '}
        <a className="text-sky-700 hover:underline" href="https://devmais.com" target="_blank" rel="noreferrer">
          Dev+
        </a>
      </footer>
    </div>
  );
}
