import type { ReactNode } from 'react';

export function Card(props: { title?: string; description?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {(props.title || props.description) && (
        <div className="mb-4">
          {props.title && <div className="text-base font-semibold text-slate-900">{props.title}</div>}
          {props.description && <div className="text-sm text-slate-600">{props.description}</div>}
        </div>
      )}
      {props.children}
    </div>
  );
}

