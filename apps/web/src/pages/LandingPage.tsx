import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { env } from '../lib/env';
import { LANDING_COPY } from '../lib/landing-copy';
import { FALLBACK_PUBLIC_PLANS, formatPlanPrice, subscribeHref, type PublicPlan } from '../lib/public-plans';
import { MarketingShell } from '../components/layout/MarketingShell';

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
    </MarketingShell>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-opiina-bg" />
      <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-opiina-cyan/15 blur-3xl" />
      <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-opiina-violet/15 blur-3xl" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-20">
        <div className="text-sm font-medium text-opiina-cyan">{LANDING_COPY.brand.tagline}</div>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-opiina-navy md:text-5xl">
          {LANDING_COPY.hero.headline}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-opiina-muted">{LANDING_COPY.hero.sub}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {LANDING_COPY.brand.chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex rounded-full border border-opiina-border bg-white px-3 py-1 text-xs font-medium text-opiina-navy"
            >
              {chip}
            </span>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to={subscribeHref()}
            className="inline-flex h-11 items-center justify-center rounded-full bg-opiina-cta px-5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {LANDING_COPY.hero.ctaPrimary}
          </Link>
          <a
            href="#como-funciona"
            className="inline-flex h-11 items-center justify-center rounded-full border border-opiina-border bg-white px-5 text-sm font-medium text-opiina-navy hover:bg-opiina-bg"
          >
            {LANDING_COPY.hero.ctaSecondary}
          </a>
        </div>
        <div className="mt-3 text-sm text-opiina-muted">{LANDING_COPY.hero.micro}</div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
        <div className="text-sm font-medium text-opiina-cyan">{LANDING_COPY.steps.eyebrow}</div>
        <h2 className="mt-2 text-3xl font-semibold text-opiina-navy">{LANDING_COPY.steps.title}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {LANDING_COPY.steps.items.map((step, index) => (
            <div
              key={step.title}
              className="rounded-[28px] border border-opiina-border bg-opiina-bg p-5"
            >
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-opiina-cta text-sm font-semibold text-white">
                {index + 1}
              </div>
              <div className="mt-4 text-base font-semibold text-opiina-navy">{step.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-opiina-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section id="beneficios" className="scroll-mt-20 bg-opiina-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
        <h2 className="text-3xl font-semibold text-opiina-navy">{LANDING_COPY.benefits.title}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_COPY.benefits.items.map((item) => (
            <div key={item} className="rounded-[28px] border border-opiina-border bg-white p-5">
              <div className="text-base font-semibold text-opiina-navy">{item}</div>
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
        <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
          <h2 className="text-3xl font-semibold text-opiina-navy">{LANDING_COPY.plans.title}</h2>
          <p className="mt-2 text-sm text-opiina-muted">{LANDING_COPY.plans.subtitle}</p>
        </div>
      </section>
    );
  }

  const items = plans.isError ? FALLBACK_PUBLIC_PLANS : (plans.data ?? []);
  if (items.length === 0) return null;

  return (
    <section id="planos" className="scroll-mt-20 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
        <h2 className="text-3xl font-semibold text-opiina-navy">{LANDING_COPY.plans.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-opiina-muted">{LANDING_COPY.plans.subtitle}</p>
        <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-3">
          {items.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanBadge({ slug, label }: { slug: string; label: string }) {
  const solid = slug === 'pro';
  return (
    <span
      className={[
        'inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-medium leading-none',
        solid
          ? 'bg-opiina-cta text-white'
          : 'border border-opiina-border bg-opiina-bg text-opiina-navy',
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function PlanCard({ plan }: { plan: PublicPlan }) {
  return (
    <article className="flex h-full flex-col rounded-[28px] border border-opiina-border bg-white p-6">
      <PlanBadge slug={plan.slug} label={plan.badge} />
      <h3 className="mt-4 text-xl font-semibold text-opiina-navy">{plan.name}</h3>
      <p className="mt-2 text-sm text-opiina-muted">{plan.summary}</p>
      <div className="mt-5 flex items-end gap-1">
        <div className="text-3xl font-semibold text-opiina-navy">
          {formatPlanPrice(plan.priceCents, plan.currency)}
        </div>
        <div className="pb-1 text-sm text-opiina-muted">/mês</div>
      </div>
      <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-opiina-navy">
        {plan.features.map((feature, index) => (
          <li key={`${plan.slug}-${index}`} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-opiina-cyan" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Link
          to={subscribeHref(plan.slug)}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-opiina-cta text-sm font-medium text-white hover:bg-blue-700"
        >
          {plan.ctaLabel}
        </Link>
        <div className="mt-3 text-center text-sm text-opiina-muted">{LANDING_COPY.plans.trialLine}</div>
      </div>
    </article>
  );
}

function Who() {
  return (
    <section id="para-quem" className="scroll-mt-20 bg-opiina-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
        <h2 className="text-3xl font-semibold text-opiina-navy">{LANDING_COPY.who.title}</h2>
        <ul className="mt-8 grid gap-3 md:grid-cols-2">
          {LANDING_COPY.who.items.map((item) => (
            <li
              key={item}
              className="rounded-[28px] border border-opiina-border bg-white px-5 py-4 text-sm leading-relaxed text-opiina-navy"
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
      <div className="mx-auto w-full max-w-3xl px-4 py-14 md:px-6">
        <div className="text-sm font-medium text-opiina-cyan">{LANDING_COPY.faq.eyebrow}</div>
        <h2 className="mt-2 text-3xl font-semibold text-opiina-navy">{LANDING_COPY.faq.title}</h2>
        <div className="mt-8 divide-y divide-opiina-border rounded-[28px] border border-opiina-border bg-white">
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
                  <span className="text-sm font-medium text-opiina-navy">{item.q}</span>
                  <span className="text-opiina-muted">{open ? '−' : '+'}</span>
                </button>
                {open && <div className="px-5 pb-4 text-sm leading-relaxed text-opiina-muted">{item.a}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
