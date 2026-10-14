import { Icone } from '../painel/Icone';

type Props = {
  value: number | null;
  onChange: (value: number) => void;
  labelledBy?: string;
};

export function Stars1to5({ value, onChange, labelledBy }: Props) {
  return (
    <div className="cli__estrelas" role="group" aria-labelledby={labelledBy}>
      {[1, 2, 3, 4, 5].map((n) => {
        const cheia = typeof value === 'number' && n <= value;
        return (
          <button
            key={n}
            type="button"
            className="cli__opcao"
            aria-pressed={value === n}
            aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            onClick={() => onChange(n)}
          >
            <Icone nome={cheia ? 'estrela-cheia' : 'estrela'} />
          </button>
        );
      })}
    </div>
  );
}
