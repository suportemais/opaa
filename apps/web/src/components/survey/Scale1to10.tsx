type Props = {
  value: number | null;
  onChange: (value: number) => void;
};

export function Scale1to10({ value, onChange }: Props) {
  return (
    <>
      <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
        {Array.from({ length: 10 }).map((_, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              className={[
                'h-10 rounded-md border text-sm font-medium',
                value === n
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>1 = muito ruim</span>
        <span>10 = excelente</span>
      </div>
    </>
  );
}
