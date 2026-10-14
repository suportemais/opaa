import { whistleblowerPriorityLabel, whistleblowerStatusLabel } from '../../../lib/labels';
import { Icone } from '../Icone';

const CLASSE_SITUACAO: Record<string, string> = {
  received: 'recebida',
  analyzing: 'em-analise',
  investigating: 'em-investigacao',
  awaiting_info: 'aguardando-informacoes',
  completed: 'concluida',
  archived: 'arquivada',
};
const CLASSE_PRIORIDADE: Record<string, string> = { low: 'baixa', medium: 'media', high: 'alta', critical: 'critica' };

export function SeloSituacao({ status }: { status: string }) {
  return <span className={`etapa den-sit--${CLASSE_SITUACAO[status] ?? 'em-analise'}`}>{whistleblowerStatusLabel(status)}</span>;
}

export function SeloPrioridade({ priority }: { priority: string }) {
  return (
    <span className={`den-prio den-prio--${CLASSE_PRIORIDADE[priority] ?? 'media'}`}>
      <span className="visualmente-oculto">Prioridade </span>
      {whistleblowerPriorityLabel(priority)}
    </span>
  );
}

export function SeloIdent({ anonima }: { anonima: boolean }) {
  return anonima ? (
    <span className="den-ident den-ident--anonima">
      <Icone nome="cadeado" />
      Anônima
    </span>
  ) : (
    <span className="den-ident">
      <Icone nome="pessoa" />
      Identificada
    </span>
  );
}

