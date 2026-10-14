import type { ReactNode } from 'react';
import {
  isPrimaryRatingType,
  isScaleExtraQuestionType,
  isScaleScore,
  isSingleChoiceQuestionType,
  isStarsQuestionType,
  isStarsScore,
  isThumbsQuestionType,
  isThumbsValue,
  shouldShowWhyFollowUp,
} from '../../lib/question-types';
import { Scale1to10 } from './Scale1to10';
import { Stars1to5 } from './Stars1to5';
import { ThumbsChoice } from './ThumbsChoice';
import { WhyFollowUp } from './WhyFollowUp';

export type PerguntaClienteDados = {
  id: string;
  title: string;
  type: string;
  required: boolean;
  description?: string | null;
  options: Array<{ value: string; label: string; negative?: boolean }>;
};

type Props = {
  pergunta: PerguntaClienteDados;
  valor: unknown;
  porque: string;
  onValor: (valor: unknown) => void;
  onPorque: (texto: string) => void;
  /** prefixo único para os ids (título/campos) */
  idBase: string;
  falta?: boolean;
  /** selo acima do título (ex.: "Só aparece para notas de 1 a 6") */
  condicao?: string | null;
  /** texto quando o título está vazio (prévia do editor) */
  tituloVazio?: string;
  /** desliga o "Por quê?" (ex.: prévia) */
  semPorque?: boolean;
};

/**
 * Uma pergunta como o cliente vê (visual .cli do protótipo). Usada na página pública
 * de responder e na prévia do editor de pesquisas.
 */
export function PerguntaCliente({
  pergunta: q,
  valor,
  porque,
  onValor,
  onPorque,
  idBase,
  falta = false,
  condicao,
  tituloVazio,
  semPorque = false,
}: Props) {
  const tituloId = `${idBase}-titulo`;
  let controle: ReactNode;

  if (isPrimaryRatingType(q.type) || isScaleExtraQuestionType(q.type)) {
    controle = (
      <Scale1to10
        value={isScaleScore(valor) ? valor : null}
        onChange={onValor}
        labelledBy={tituloId}
        legenda={isPrimaryRatingType(q.type) ? ['Nada provável', 'Muito provável'] : undefined}
      />
    );
  } else if (isThumbsQuestionType(q.type)) {
    controle = <ThumbsChoice value={isThumbsValue(valor) ? valor : null} onChange={onValor} labelledBy={tituloId} />;
  } else if (isStarsQuestionType(q.type)) {
    controle = <Stars1to5 value={isStarsScore(valor) ? valor : null} onChange={onValor} labelledBy={tituloId} />;
  } else if (q.type === 'text_short') {
    controle = (
      <input
        className="cli__campo"
        aria-labelledby={tituloId}
        value={typeof valor === 'string' ? valor : ''}
        onChange={(e) => onValor(e.target.value)}
        placeholder="Digite aqui"
      />
    );
  } else if (q.type === 'text_long') {
    controle = (
      <textarea
        className="cli__caixa"
        rows={3}
        aria-labelledby={tituloId}
        value={typeof valor === 'string' ? valor : ''}
        onChange={(e) => onValor(e.target.value)}
        placeholder="Escreva aqui"
      />
    );
  } else if (isSingleChoiceQuestionType(q.type)) {
    const opcoes = q.options.length ? q.options : [
      { value: '__1', label: 'Opção 1' },
      { value: '__2', label: 'Opção 2' },
    ];
    controle = (
      <div className="cli__opcoes" role="group" aria-labelledby={tituloId}>
        {opcoes.map((o) => (
          <button
            key={o.value}
            type="button"
            className="cli__opcao"
            aria-pressed={valor === o.value}
            onClick={() => onValor(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  } else {
    controle = <p className="cli__desc">Tipo de pergunta não suportado: {q.type}</p>;
  }

  const mostrarPorque =
    !semPorque && shouldShowWhyFollowUp({ type: q.type, value: valor, options: q.options });

  return (
    <div className={`cli__q${falta ? ' cli__q--falta' : ''}`}>
      {condicao && <span className="cli__condicao">{condicao}</span>}
      <p className="cli__q-titulo" id={tituloId}>
        {q.title.trim() ? q.title : <span className="cli__vazio">{tituloVazio ?? 'Pergunta'}</span>}
        {q.required && (
          <span className="obrigatorio" aria-label="obrigatória">
            *
          </span>
        )}
      </p>
      {controle}
      {q.description && <p className="cli__desc">{q.description}</p>}
      {mostrarPorque && <WhyFollowUp value={porque} onChange={onPorque} />}
      {falta && <p className="cli__erro">Responda esta pergunta.</p>}
    </div>
  );
}
