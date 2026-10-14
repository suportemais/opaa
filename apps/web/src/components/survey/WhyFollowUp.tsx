import { useId } from 'react';
import {
  WHY_FOLLOWUP_MICROCOPY,
  WHY_FOLLOWUP_PLACEHOLDER,
  WHY_FOLLOWUP_QUESTION,
} from '../../lib/question-types';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function WhyFollowUp({ value, onChange }: Props) {
  const id = useId();
  return (
    <div className="pq-porque">
      <label className="cli__q-titulo" htmlFor={id}>
        {WHY_FOLLOWUP_QUESTION}
      </label>
      <textarea
        id={id}
        className="cli__caixa"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={WHY_FOLLOWUP_PLACEHOLDER}
        aria-describedby={`${id}-dica`}
      />
      <p className="cli-pop__opcional pq-porque__dica" id={`${id}-dica`}>
        {WHY_FOLLOWUP_MICROCOPY}
      </p>
    </div>
  );
}
