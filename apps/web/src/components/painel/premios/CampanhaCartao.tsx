import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { unitCnpjLine } from '../../../lib/cnpj';
import { Icone } from '../Icone';
import { type Campanha, type Situacao, type UnidadeCnpj, SITUACAO, dataCurta, diasAte, real } from './util';

export type AcaoCampanha = 'editar' | 'pausar' | 'retomar' | 'encerrar' | 'cancelar' | 'modelo';

function periodo(c: Campanha, st: Situacao) {
  const de = dataCurta(c.startsAt);
  const ate = dataCurta(c.endsAt);
  const faixa = de && ate ? `${de} a ${ate}` : de ? `Desde ${de}` : ate ? `Até ${ate}` : 'Sem datas definidas';
  if (st === 'agendada') {
    const d = diasAte(c.startsAt) ?? 0;
    return `${faixa} · começa em ${d} ${d === 1 ? 'dia' : 'dias'}`;
  }
  if (st === 'encerrada') return `${faixa} · encerrada`;
  const d = diasAte(c.endsAt);
  if (d === null) return faixa;
  return `${faixa} · ${d <= 0 ? 'termina hoje' : `termina em ${d} ${d === 1 ? 'dia' : 'dias'}`}`;
}

export function CampanhaCartao(props: {
  campanha: Campanha;
  situacao: Situacao;
  unidade?: UnidadeCnpj;
  podeGerir: boolean;
  ocupado: boolean;
  onAcao: (acao: AcaoCampanha, c: Campanha) => void;
}) {
  const { campanha: c, situacao: st, podeGerir } = props;
  const { rotulo, classe } = SITUACAO[st];
  const enviados = c.issuedCount ?? 0;
  const resgatados = c.redeemedCount ?? 0;
  const taxa = enviados ? Math.round((resgatados / enviados) * 100) : 0;
  const valorUsado = typeof c.rewardAmountCents === 'number' ? resgatados * c.rewardAmountCents : null;
  const nomeUnidade = c.unitName || c.issuer?.tradeName || props.unidade?.name;
  const cnpj = c.cnpj || c.issuer?.cnpj || props.unidade?.document;
  const semCnpj = st !== 'encerrada' && Boolean(c.unitId || nomeUnidade) && !cnpj;
  const finalizada = c.status === 'finished';
  const id = `cp-${c.id}`;

  const botao = (acao: AcaoCampanha, texto: string, classeBtn = 'btn--secundario', icone?: 'editar' | 'mais') => (
    <button key={acao} className={`btn ${classeBtn}`} type="button" disabled={props.ocupado} onClick={() => props.onAcao(acao, c)}>
      {icone && <Icone nome={icone} />}
      {texto}
    </button>
  );

  let acoes: ReactNode[] = [];
  if (podeGerir) {
    if (finalizada) acoes = [botao('modelo', 'Usar como modelo', 'btn--secundario', 'mais'), botao('editar', 'Editar', 'btn--fantasma', 'editar')];
    else if (st === 'encerrada') acoes = [botao('editar', 'Editar', 'btn--secundario', 'editar'), botao('encerrar', 'Encerrar', 'btn--perigo'), botao('modelo', 'Usar como modelo', 'btn--fantasma', 'mais')];
    else if (st === 'ativa') acoes = [botao('editar', 'Editar', 'btn--secundario', 'editar'), botao('pausar', 'Pausar'), botao('encerrar', 'Encerrar', 'btn--perigo')];
    else if (st === 'pausada' || st === 'rascunho')
      acoes = [botao('retomar', st === 'rascunho' ? 'Ativar' : 'Retomar', 'btn--primario'), botao('editar', 'Editar', 'btn--secundario', 'editar'), botao('encerrar', 'Encerrar', 'btn--perigo')];
    else if (st === 'agendada') acoes = [botao('editar', 'Editar', 'btn--secundario', 'editar'), botao('cancelar', 'Cancelar campanha', 'btn--perigo')];
  }

  return (
    <li>
      <article className="cartao pq-cartao" aria-labelledby={id}>
        <div className="pq-cartao__topo">
          <span className={`status status--${classe}`}>{rotulo}</span>
          <span className="pq-cartao__id">Código {c.prefix || 'MM'}</span>
        </div>
        <div>
          <h2 className="pq-cartao__nome" id={id}>
            {c.name}
          </h2>
          {c.description && <p className="cartao__sub">{c.description}</p>}
          <p className="pq-cartao__meta">
            <span>
              <Icone nome="premios" />
              {real(c.rewardAmountCents)} por cliente{c.validityDays ? ` · vale ${c.validityDays} dias` : ''}
            </span>
            <span>
              <Icone nome="pesquisas" />
              {c.surveyName ?? 'Sem pesquisa'}
            </span>
            <span>
              <Icone nome="loja" />
              {nomeUnidade ? unitCnpjLine(nomeUnidade, cnpj) : 'Sem unidade'}
            </span>
            <span>
              <Icone nome="relogio" />
              {periodo(c, st)}
            </span>
            <span>
              <Icone nome="cadeado" />
              {c.perCustomerLimit ?? 1} por cliente
              {typeof c.totalLimit === 'number' ? ` · limite total ${c.totalLimit}` : ''}
            </span>
          </p>
        </div>
        {semCnpj && (
          <p className="pr-alerta" role="note">
            <Icone nome="alerta" />
            <span>
              {nomeUnidade ?? 'A unidade'} não tem CNPJ cadastrado: os vouchers não são gerados nela.{' '}
              <Link className="link-texto" to="/app/units">
                Cadastrar CNPJ
              </Link>
            </span>
          </p>
        )}
        {st === 'agendada' && enviados === 0 ? (
          <div className="pq-cartao__numero">
            <span>Ainda não começou. Os vouchers saem a partir de {dataCurta(c.startsAt)}.</span>
          </div>
        ) : (
          <div className="pr-numeros">
            <p>
              <strong>{enviados.toLocaleString('pt-BR')}</strong> enviados · <strong>{resgatados.toLocaleString('pt-BR')}</strong>{' '}
              resgatados
            </p>
            <div className="pr-barra" role="img" aria-label={`${taxa}% dos vouchers resgatados`}>
              <span style={{ width: `${taxa}%` }} />
            </div>
            <p className="mudo">
              {taxa}% de resgate{valorUsado !== null ? ` · ${real(valorUsado)} em vouchers usados` : ''}
            </p>
          </div>
        )}
        {acoes.length > 0 && <div className="pq-cartao__acoes">{acoes}</div>}
      </article>
    </li>
  );
}
