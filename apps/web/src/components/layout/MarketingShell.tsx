import { Link } from 'react-router-dom';
import { BrandMark } from '../BrandMark';
import { LANDING_COPY } from '../../lib/landing-copy';
import { subscribeHref } from '../../lib/public-plans';

export function MarketingShell(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-white text-opiina-navy">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 overflow-visible px-4 py-3 md:px-6">
          <Link to="/" className="min-w-0 overflow-visible">
            <BrandMark />
          </Link>
          <Link
            to={subscribeHref()}
            className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-opiina-cta px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            {LANDING_COPY.cta.primary}
          </Link>
        </div>
        <div className="h-px bg-gradient-to-r from-opiina-cyan to-opiina-violet" />
      </header>

      <main>{props.children}</main>

      <footer className="border-t border-opiina-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-4 px-4 py-10 md:flex-row md:items-center md:px-6">
          <p className="text-sm text-opiina-muted">{LANDING_COPY.footer.microcopy}</p>
          <Link to="/login" className="text-sm font-medium text-opiina-cta hover:underline">
            {LANDING_COPY.cta.login}
          </Link>
        </div>
      </footer>
    </div>
  );
}
