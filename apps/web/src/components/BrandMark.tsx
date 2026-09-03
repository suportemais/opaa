import { LANDING_COPY } from '../lib/landing-copy';

export function SpeechBubble({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="opiina-bubble" x1="8" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A94FF" />
          <stop offset="1" stopColor="#7038F8" />
        </linearGradient>
      </defs>
      <path
        d="M10 12.5c0-4.14 3.36-7.5 7.5-7.5h13c6.9 0 12.5 5.6 12.5 12.5 0 3.95-1.84 7.47-4.7 9.75v6.25c0 .9-.98 1.45-1.75.98L28.2 29.6c-1.48.35-3.05.54-4.7.54C16.14 30.14 10 24.5 10 17.5v-5Z"
        fill="url(#opiina-bubble)"
      />
      <circle cx="22.5" cy="17.5" r="5.2" fill="white" fillOpacity="0.95" />
      <circle cx="22.5" cy="17.5" r="2.4" fill="url(#opiina-bubble)" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <SpeechBubble className="h-9 w-9 shrink-0" />
      <span className="min-w-0 leading-tight">
        <span className="block text-base font-semibold text-opiina-navy">Opiina</span>
        <span className="block text-[11px] leading-tight text-opiina-muted">{LANDING_COPY.brand.tagline}</span>
      </span>
    </span>
  );
}
