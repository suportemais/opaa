import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../BrandLogo';
import { Button } from '../ui/Button';
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
    <div className="min-h-full bg-white text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link to="/" className="inline-flex items-center" onClick={() => setOpen(false)}>
            <BrandLogo className="h-9 drop-shadow-sm" />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {LANDING_COPY.cta.login}
            </Link>
            <Link to={subscribeHref()}>
              <Button>{LANDING_COPY.cta.primary}</Button>
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 md:hidden"
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

        {open && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link
                to="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                {LANDING_COPY.cta.login}
              </Link>
              <Link to={subscribeHref()} onClick={() => setOpen(false)} className="pt-1">
                <Button className="w-full">{LANDING_COPY.cta.primary}</Button>
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>{props.children}</main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <BrandLogo className="h-8" />
            <div className="mt-3 max-w-sm text-sm text-slate-600">{LANDING_COPY.footer.microcopy}</div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <Link to={subscribeHref()} className="hover:text-slate-900">
              {LANDING_COPY.cta.primary}
            </Link>
            <a href="#como-funciona" className="hover:text-slate-900">
              {LANDING_COPY.cta.secondary}
            </a>
            <a href="#planos" className="hover:text-slate-900">
              {LANDING_COPY.cta.plan}
            </a>
            <Link to="/login" className="hover:text-slate-900">
              {LANDING_COPY.cta.login}
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          Desenvolvido por{' '}
          <a className="text-sky-700 hover:underline" href="https://devmais.com" target="_blank" rel="noreferrer">
            Dev+
          </a>
        </div>
      </footer>
    </div>
  );
}
