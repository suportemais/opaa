import { Link } from 'react-router-dom';
import { BrandMark } from '../BrandMark';
import { LANDING_COPY } from '../../lib/landing-copy';
import { subscribeHref } from '../../lib/public-plans';

export function MarketingShell(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-opiina-bg text-opiina-navy">
      <header className="sticky top-0 z-20 border-b border-opiina-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="min-w-0">
            <BrandMark />
          </Link>
          <Link
            to={subscribeHref()}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-opiina-cta px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            {LANDING_COPY.cta.primary}
          </Link>
        </div>
      </header>

      <main>{props.children}</main>

      <footer className="border-t border-opiina-border bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <BrandMark />
            <div className="mt-3 max-w-sm text-sm text-opiina-muted">{LANDING_COPY.footer.microcopy}</div>
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
