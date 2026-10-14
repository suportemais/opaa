type Props = {
  value: number | null;
  onChange: (value: number) => void;
  /** id do título da pergunta (aria-labelledby do grupo) */
  labelledBy?: string;
  /** legenda das pontas da escala */
  legenda?: [string, string];
};

export function Scale1to10({ value, onChange, labelledBy, legenda = ['1 = muito ruim', '10 = excelente'] }: Props) {
  return (
    <>
      <div className="cli__escala cli__escala--10" role="group" aria-labelledby={labelledBy}>
        {Array.from({ length: 10 }).map((_, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              className="cli__opcao"
              aria-pressed={value === n}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="cli__escala-legenda" aria-hidden="true">
        <span>{legenda[0]}</span>
        <span>{legenda[1]}</span>
      </div>
    </>
  );
}
