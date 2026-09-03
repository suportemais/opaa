import { Button } from '../ui/Button';

export function AdminEmptyState(props: {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/15 to-violet-500/15 text-cyan-700">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 8v5" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
          <path d="M4.6 19.4 12 4.8l7.4 14.6H4.6Z" />
        </svg>
      </div>
      <div className="text-base font-semibold text-slate-900">{props.title}</div>
      <div className="mx-auto mt-1 max-w-md text-sm text-slate-600">{props.description}</div>
      {props.onRetry && (
        <Button className="mt-5 bg-cyan-600 hover:bg-cyan-700" onClick={props.onRetry}>
          {props.retryLabel ?? 'Tentar novamente'}
        </Button>
      )}
    </div>
  );
}
