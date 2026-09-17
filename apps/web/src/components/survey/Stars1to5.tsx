type Props = {
  value: number | null;
  onChange: (value: number) => void;
};

export function Stars1to5({ value, onChange }: Props) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = typeof value === 'number' && n <= value;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
              className={[
                'flex h-12 w-12 items-center justify-center rounded-md border text-2xl',
                selected
                  ? 'border-amber-400 bg-amber-50 text-amber-500'
                  : 'border-slate-200 bg-white text-slate-300 hover:bg-slate-50',
              ].join(' ')}
              onClick={() => onChange(n)}
            >
              ★
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>1 estrela</span>
        <span>5 estrelas</span>
      </div>
    </>
  );
}
