import { Icone } from '../painel/Icone';

type Props = {
  value: 'up' | 'down' | null;
  onChange: (value: 'up' | 'down') => void;
  labelledBy?: string;
};

export function ThumbsChoice({ value, onChange, labelledBy }: Props) {
  return (
    <div className="cli__polegares" role="group" aria-labelledby={labelledBy}>
      <button
        type="button"
        className="cli__opcao"
        aria-label="Gostei"
        aria-pressed={value === 'up'}
        onClick={() => onChange('up')}
      >
        <Icone nome="polegar" />
      </button>
      <button
        type="button"
        className="cli__opcao"
        aria-label="Não gostei"
        aria-pressed={value === 'down'}
        onClick={() => onChange('down')}
      >
        <Icone nome="polegar" />
      </button>
    </div>
  );
}
