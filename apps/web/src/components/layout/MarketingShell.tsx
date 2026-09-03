import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../BrandLogo';
import { LANDING_COPY } from '../../lib/landing-copy';
import { subscribeHref } from '../../lib/public-plans';

const NAV = [
  { href: '#como-funciona', label: LANDING_COPY.steps.eyebrow },
  { href: '#beneficios', label: LANDING_COPY.benefits.title },
  { href: '#planos', label: LANDING_COPY.cta.plan },
  { href: '#faq', label: LANDING_COPY.faq.title },
] as const;

export function MarketingShell(props: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-full bg-opiina-bg text-opiina-navy">
      <header className="sticky top-0 z-20 border-b border-opiina-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="inline-flex min-w-0 items-center gap-2" onClick={() => setOpen(false)}>
            <BrandLogo className="h-8 drop-shadow-sm md:h-9" />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-2 text-sm text-opiina-muted hover:bg-opiina-bg hover:text-opiina-navy"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-opiina-muted hover:text-opiina-navy md:inline-flex"
            >
              {LANDING_COPY.cta.login}
            </Link>
            <Link
              to={subscribeHref()}
              className="inline-flex h-10 items-center justify-center rounded-full bg-opiina-cta px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              {LANDING_COPY.cta.primary}
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-opiina-border text-opiina-navy lg:hidden"
              aria-expanded={open}
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">Menu</span>
              <span aria-hidden className="text-lg leading-none">
                {open ? '×' : '☰'}
              </span>
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-opiina-border bg-white px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-2 text-sm text-opiina-navy hover:bg-opiina-bg"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link
                to="/login"
                className="rounded-xl px-3 py-2 text-sm font-medium text-opiina-navy hover:bg-opiina-bg"
                onClick={() => setOpen(false)}
              >
                {LANDING_COPY.cta.login}
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>{props.children}</main>

      <footer className="border-t border-opiina-border bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <BrandLogo className="h-8" />
            <div className="mt-2 text-sm font-medium text-opiina-navy">{LANDING_COPY.brand.tagline}</div>
            <div className="mt-1 max-w-sm text-sm text-opiina-muted">{LANDING_COPY.footer.microcopy}</div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-opiina-muted">
            <Link to={subscribeHref()} className="hover:text-opiina-navy">
              {LANDING_COPY.cta.primary}
            </Link>
            <a href="#como-funciona" className="hover:text-opiina-navy">
              {LANDING_COPY.cta.secondary}
            </a>
            <a href="#planos" className="hover:text-opiina-navy">
              {LANDING_COPY.cta.plan}
            </a>
            <Link to="/login" className="hover:text-opiina-navy">
              {LANDING_COPY.cta.login}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
