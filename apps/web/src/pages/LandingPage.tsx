import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { env } from '../lib/env';
import { LANDING_COPY } from '../lib/landing-copy';
import { FALLBACK_PUBLIC_PLANS, formatPlanPrice, subscribeHref, type PublicPlan } from '../lib/public-plans';
import { MarketingShell } from '../components/layout/MarketingShell';

const FEATURE_ACCENTS = [
  'var(--opiina-feature-1)',
  'var(--opiina-feature-2)',
  'var(--opiina-feature-3)',
] as const;

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
      <Features />
      <Plans />
      <Who />
      <Faq />
    </MarketingShell>
  );
}

function Hero() {
  return (
    <section className="px-4 py-10 md:px-6 md:py-16">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
        <div>
          <h1 className="max-w-xl text-3xl font-semibold leading-tight text-opiina-navy md:text-5xl">
            {LANDING_COPY.hero.headline}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-opiina-muted">{LANDING_COPY.hero.sub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={subscribeHref()}
              className="inline-flex h-11 items-center justify-center rounded-full bg-opiina-cta px-5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {LANDING_COPY.hero.ctaPrimary}
            </Link>
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-full border border-opiina-cta px-5 text-sm font-medium text-opiina-cta hover:bg-white"
            >
              {LANDING_COPY.cta.login}
            </Link>
          </div>
          <div className="mt-3 text-sm text-opiina-muted">
            {LANDING_COPY.hero.micro} ·{' '}
            <a href="#como-funciona" className="font-medium text-opiina-cta hover:underline">
              {LANDING_COPY.hero.ctaSecondary}
            </a>
          </div>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative" data-hero-visual="usage-and-nps">
      <div
        data-hero-slot="usage-photo"
        className="overflow-hidden rounded-[28px] border border-opiina-border bg-[#E8F3FF] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)]"
      >
        <img
          src="/landing/hero-usage.jpg"
          alt="Atendimento no balcão — uso do OPIINA na operação"
          className="aspect-[4/3] h-full w-full object-cover object-[center_20%]"
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center sm:bottom-6 sm:justify-end sm:pr-6 lg:bottom-8 lg:pr-8">
        <div className="w-[200px] sm:w-[220px] md:w-[236px]">
          <NpsPhoneMock />
        </div>
      </div>
    </div>
  );
}

function NpsPhoneMock() {
  const selected = 9;

  return (
    <div
      data-hero-slot="nps-mock"
      className="rounded-[36px] border-[8px] border-[#0F172A] bg-white p-3.5 shadow-[0_18px_40px_-16px_rgba(15,23,42,0.45)]"
      aria-hidden
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
      <div className="text-[10px] font-medium text-opiina-muted">Sua opinião</div>
      <div className="mt-1 text-sm font-semibold text-opiina-navy">Como foi sua visita?</div>
      <div className="mt-0.5 text-[11px] text-opiina-muted">Em uma palavra:</div>
      <div className="mt-3 grid grid-cols-11 gap-0.5">
        {Array.from({ length: 11 }, (_, value) => {
          const near = value >= 6 && value <= 8;
          return (
            <div
              key={value}
              className={[
                'flex h-6 items-center justify-center rounded-sm text-[9px] font-semibold',
                value === selected
                  ? 'bg-opiina-cta text-white'
                  : near
                    ? 'bg-[#E8F3FF] text-opiina-cta'
                    : 'border border-opiina-border bg-white text-opiina-navy',
              ].join(' ')}
            >
              {value}
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <div className="mb-1 text-[10px] text-opiina-muted">Comentário (opcional)</div>
        <div className="rounded-lg border border-opiina-border bg-opiina-bg px-2.5 py-2 text-[11px] text-opiina-navy">
          Atendimento rápido..
        </div>
      </div>
    </div>
  );
}

function Steps() {
  return (
    <section id="como-funciona" className="scroll-mt-20 px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="text-sm font-semibold text-opiina-cta">{LANDING_COPY.steps.eyebrow}</div>
        <h2 className="mt-1 text-2xl font-semibold text-opiina-navy md:text-3xl">{LANDING_COPY.steps.title}</h2>
        <div className="mt-6 grid items-stretch gap-3 md:grid-cols-3">
          {LANDING_COPY.steps.items.map((step, index) => (
            <div key={step.title} className="flex h-full flex-col rounded-[28px] border border-opiina-border bg-white p-5">
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
    <section id="beneficios" className="scroll-mt-20 px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="text-2xl font-semibold text-opiina-navy md:text-3xl">{LANDING_COPY.benefits.title}</h2>
        <ul className="mt-6 space-y-2">
          {LANDING_COPY.benefits.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-2xl border border-opiina-border bg-white px-4 py-3 text-sm text-opiina-navy"
            >
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-opiina-cta" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="alem-do-nps" className="scroll-mt-20 px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="text-2xl font-semibold text-opiina-navy md:text-3xl">{LANDING_COPY.features.title}</h2>
        <div className="mt-6 space-y-3">
          {LANDING_COPY.features.items.map((item, index) => {
            const accent = FEATURE_ACCENTS[index] ?? FEATURE_ACCENTS[0];
            return (
              <article
                key={item.title}
                className="overflow-hidden rounded-2xl border border-opiina-border bg-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]"
              >
                <div className="flex">
                  <div className="w-1.5 shrink-0" style={{ backgroundColor: accent }} />
                  <div className="min-w-0 flex-1 px-5 py-4">
                    <h3 className="text-base font-semibold text-opiina-navy">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-opiina-muted">{item.body}</p>
                    {'micro' in item && item.micro ? (
                      <p className="mt-2 text-xs font-medium" style={{ color: accent }}>
                        {item.micro}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <a
          href="#planos"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-opiina-cta px-5 text-sm font-medium text-opiina-cta hover:bg-white"
        >
          {LANDING_COPY.features.cta}
        </a>
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
      <section id="planos" className="scroll-mt-20 px-4 py-10 md:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-2xl font-semibold text-opiina-navy md:text-3xl">{LANDING_COPY.plans.title}</h2>
          <p className="mt-2 text-sm text-opiina-muted">{LANDING_COPY.plans.subtitle}</p>
        </div>
      </section>
    );
  }

  const items = plans.isError ? FALLBACK_PUBLIC_PLANS : (plans.data ?? []);
  if (items.length === 0) return null;

  return (
    <section id="planos" className="scroll-mt-20 px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="text-2xl font-semibold text-opiina-navy md:text-3xl">{LANDING_COPY.plans.title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-opiina-muted">{LANDING_COPY.plans.subtitle}</p>
        <div className="mt-6 grid items-stretch gap-3 md:grid-cols-3">
          {items.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanBadge({ slug, label }: { slug: string; label: string | null }) {
  if (!label) return null;
  const tone =
    slug === 'pro'
      ? 'bg-opiina-cta text-white'
      : slug === 'redes'
        ? 'bg-[#F3E8FF] text-opiina-violet'
        : 'bg-[#E8F3FF] text-opiina-cta';

  return (
    <span className={`inline-flex w-fit max-w-full rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${tone}`}>
      {label}
    </span>
  );
}

function PlanCard({ plan }: { plan: PublicPlan }) {
  return (
    <article className="flex h-full flex-col justify-between gap-4 rounded-[28px] border border-opiina-border bg-white p-5">
      <div className="min-w-0">
        <PlanBadge slug={plan.slug} label={plan.badge} />
        <h3 className="mt-3 text-xl font-semibold text-opiina-navy">{plan.name}</h3>
        <p className="mt-1 text-sm text-opiina-muted">{plan.summary}</p>
        <div className="mt-3 flex items-end gap-1">
          <div className="text-3xl font-semibold text-opiina-navy">
            {formatPlanPrice(plan.priceCents, plan.currency)}
          </div>
          <div className="pb-1 text-sm text-opiina-muted">/mês</div>
        </div>
        <div className="mt-2 text-sm text-opiina-muted">{LANDING_COPY.hero.micro}</div>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-opiina-navy">
          {plan.features.map((feature, index) => (
            <li key={`${plan.slug}-${index}`}>{feature}</li>
          ))}
        </ul>
      </div>
      <Link
        to={subscribeHref(plan.slug)}
        className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-full bg-opiina-cta px-5 text-sm font-medium text-white hover:bg-blue-700"
      >
        {plan.ctaLabel}
      </Link>
    </article>
  );
}

function Who() {
  return (
    <section id="para-quem" className="scroll-mt-20 px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="text-2xl font-semibold text-opiina-navy md:text-3xl">{LANDING_COPY.who.title}</h2>
        <div className="mt-6 grid items-stretch gap-3 md:grid-cols-2">
          {LANDING_COPY.who.blocks.map((block) => (
            <div key={block.title} className="rounded-[28px] border border-opiina-border bg-white px-5 py-4">
              <div
                className={[
                  'text-base font-semibold',
                  block.title === 'Rede' ? 'text-opiina-violet' : 'text-opiina-cyan',
                ].join(' ')}
              >
                {block.title}
              </div>
              <ul className="mt-3 space-y-2">
                {block.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-opiina-navy">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-opiina-navy" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="scroll-mt-20 px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="text-2xl font-semibold text-opiina-navy md:text-3xl">{LANDING_COPY.faq.title}</h2>
        <div className="mt-6 space-y-2">
          {LANDING_COPY.faq.items.map((item, index) => {
            const open = openIndex === index;
            return (
              <div key={item.q} className="rounded-2xl border border-opiina-border bg-white">
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
