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
  return (
    <div className="mt-4">
      <div className="mb-2 text-sm font-medium text-slate-800">{WHY_FOLLOWUP_QUESTION}</div>
      <textarea
        className="min-h-28 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={WHY_FOLLOWUP_PLACEHOLDER}
      />
      <div className="mt-2 text-xs text-slate-500">{WHY_FOLLOWUP_MICROCOPY}</div>
    </div>
  );
}
