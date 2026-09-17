type Props = {
  value: 'up' | 'down' | null;
  onChange: (value: 'up' | 'down') => void;
};

export function ThumbsChoice({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        aria-label="Polegar para cima"
        className={[
          'flex h-16 items-center justify-center rounded-md border text-3xl',
          value === 'up'
            ? 'border-sky-600 bg-sky-600 text-white'
            : 'border-slate-200 bg-white hover:bg-slate-50',
        ].join(' ')}
        onClick={() => onChange('up')}
      >
        👍
      </button>
      <button
        type="button"
        aria-label="Polegar para baixo"
        className={[
          'flex h-16 items-center justify-center rounded-md border text-3xl',
          value === 'down'
            ? 'border-sky-600 bg-sky-600 text-white'
            : 'border-slate-200 bg-white hover:bg-slate-50',
        ].join(' ')}
        onClick={() => onChange('down')}
      >
        👎
      </button>
    </div>
  );
}
