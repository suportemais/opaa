import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { env } from '../lib/env';
import { LANDING_COPY } from '../lib/landing-copy';
import { FALLBACK_PUBLIC_PLANS, formatPlanPrice, subscribeHref, type PublicPlan } from '../lib/public-plans';
import { MarketingShell } from '../components/layout/MarketingShell';
import { Button } from '../components/ui/Button';

function isTenantSubdomain() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  const baseDomain = env.appBaseDomain;
  return Boolean(baseDomain) && hostname !== baseDomain && hostname.endsWith(`.${baseDomain}`);
}

export function LandingPage() {
  if (isTenantSubdomain()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MarketingShell>
      <Hero />
      <Steps />
      <Benefits />
      <Plans />
      <Who />
      <Faq />
      <FinalCta />
    </MarketingShell>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-sky-50" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:px-6 md:py-24">
        <div>
          <div className="text-sm font-medium text-sky-700">OPIINA</div>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            {LANDING_COPY.hero.headline}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">{LANDING_COPY.hero.sub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={subscribeHref()}>
              <Button className="px-5 py-2.5">{LANDING_COPY.hero.ctaPrimary}</Button>
            </Link>
            <a href="#como-funciona">
              <Button variant="secondary" className="px-5 py-2.5">
                {LANDING_COPY.hero.ctaSecondary}
              </Button>
            </a>
          </div>
          <div className="mt-3 text-sm text-slate-500">{LANDING_COPY.hero.micro}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">{LANDING_COPY.steps.eyebrow}</div>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            {LANDING_COPY.steps.items.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="font-medium text-slate-900">
                  {index + 1}. {step.title}
                </span>
                <span className="text-slate-600"> — {step.body}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-t border-slate-100 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
        <div className="text-sm font-medium text-sky-700">{LANDING_COPY.steps.eyebrow}</div>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">{LANDING_COPY.steps.title}</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {LANDING_COPY.steps.items.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <div className="mt-4 text-base font-semibold text-slate-900">{step.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section id="beneficios" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
        <h2 className="text-3xl font-semibold text-slate-900">{LANDING_COPY.benefits.title}</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_COPY.benefits.items.map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-base font-semibold text-slate-900">{item}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Plans() {
  const plans = useQuery({
    queryKey: ['publicPlans'],
    queryFn: () => apiFetch<PublicPlan[]>('/public/plans'),
  });

  if (plans.isLoading) {
    return (
      <section id="planos" className="scroll-mt-20 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-3xl font-semibold text-slate-900">{LANDING_COPY.plans.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{LANDING_COPY.plans.subtitle}</p>
        </div>
      </section>
    );
  }

  const items = plans.isError ? FALLBACK_PUBLIC_PLANS : (plans.data ?? []);
  if (items.length === 0) return null;

  return (
    <section id="planos" className="scroll-mt-20 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
        <h2 className="text-3xl font-semibold text-slate-900">{LANDING_COPY.plans.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{LANDING_COPY.plans.subtitle}</p>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {items.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: PublicPlan }) {
  const highlighted = plan.slug === 'pro';
  return (
    <article
      className={[
        'flex flex-col rounded-2xl border p-6 shadow-sm',
        highlighted ? 'border-sky-400 bg-sky-50/60 ring-1 ring-sky-200' : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <div
        className={[
          'inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium',
          highlighted ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700',
        ].join(' ')}
      >
        {plan.badge}
      </div>
      <h3 className="mt-4 text-xl font-semibold text-slate-900">{plan.name}</h3>
      <p className="mt-2 text-sm text-slate-600">{plan.summary}</p>
      <div className="mt-5 flex items-end gap-1">
        <div className="text-3xl font-semibold text-slate-900">
          {formatPlanPrice(plan.priceCents, plan.currency)}
        </div>
        <div className="pb-1 text-sm text-slate-500">/mês</div>
      </div>
      <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-slate-700">
        {plan.features.map((feature, index) => (
          <li key={`${plan.slug}-${index}`} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link to={subscribeHref(plan.slug)} className="mt-6">
        <Button className="w-full" variant={highlighted ? 'primary' : 'secondary'}>
          {plan.ctaLabel}
        </Button>
      </Link>
      <div className="mt-3 text-center text-sm text-slate-500">{LANDING_COPY.plans.trialLine}</div>
    </article>
  );
}

function Who() {
  return (
    <section id="para-quem" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
        <h2 className="text-3xl font-semibold text-slate-900">{LANDING_COPY.who.title}</h2>
        <ul className="mt-8 grid gap-3 md:grid-cols-2">
          {LANDING_COPY.who.items.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm leading-relaxed text-slate-700 shadow-sm"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6">
        <div className="text-sm font-medium text-sky-700">{LANDING_COPY.faq.eyebrow}</div>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">{LANDING_COPY.faq.title}</h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {LANDING_COPY.faq.items.map((item, index) => {
            const open = openIndex === index;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? null : index)}
                >
                  <span className="text-sm font-medium text-slate-900">{item.q}</span>
                  <span className="text-slate-400">{open ? '−' : '+'}</span>
                </button>
                {open && <div className="px-5 pb-4 text-sm leading-relaxed text-slate-600">{item.a}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-sky-600">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center md:px-6">
        <div>
          <h2 className="text-3xl font-semibold text-white">{LANDING_COPY.footer.microcopy}</h2>
          <p className="mt-2 max-w-xl text-sm text-sky-100">{LANDING_COPY.hero.micro}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to={subscribeHref()}>
            <Button className="bg-white text-sky-700 hover:bg-sky-50">{LANDING_COPY.cta.primary}</Button>
          </Link>
          <a href="#como-funciona">
            <Button variant="ghost" className="text-white hover:bg-sky-500">
              {LANDING_COPY.cta.secondary}
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
