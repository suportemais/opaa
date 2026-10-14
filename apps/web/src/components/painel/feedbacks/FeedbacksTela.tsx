import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import {
  isSentimentFilterValue,
  isSentimentThemeFilterValue,
  SENTIMENT_FILTER_VALUES,
  SENTIMENT_THEME_FILTER_VALUES,
  sentimentLabel,
  sentimentThemeLabel,
} from '../../../lib/labels';
import { Icone } from '../Icone';
import { useAuthMe, usePode } from '../usePainel';
import {
  classeEtapa,
  classeNota,
  dataCompleta,
  dataHora,
  ETAPAS,
  etapaRotulo,
  nomeCliente,
  prazoInfo,
  prioridadeRotulo,
  rotuloClasseNps,
  type FeedbackItem,
  type KanbanItem,
  type Unidade,
} from './comum';
import { GavetaTratamento } from './GavetaTratamento';
import { Responsavel } from './partes';

const POR_PAGINA = 30;

// ---------------------------------------------------------------------------
// Filtros (a URL é a fonte da verdade; mesmos parâmetros que Dashboard e Ranking usam)
// ---------------------------------------------------------------------------

type Filtros = {
  case: string; // open | with | none | closed | all
  assignee: string; // any | me | unassigned
  due: string; // any | overdue | today | next7
  npsClass: string; // any | promoter | passive | detractor
  sentiment: string;
  theme: string;
  hasComment: string; // any | true | false
  from: string;
  to: string;
  unitId: string;
  q: string;
};

const PADRAO: Filtros = {
  case: 'all',
  assignee: 'any',
  due: 'any',
  npsClass: 'any',
  sentiment: 'any',
  theme: 'any',
  hasComment: 'any',
  from: '',
  to: '',
  unitId: '',
  q: '',
};

const umDe = (v: string | null, opcoes: string[], padrao: string) => (v && opcoes.includes(v) ? v : padrao);

function lerFiltros(sp: URLSearchParams): Filtros {
  const sentiment = sp.get('sentiment');
  const theme = sp.get('theme') ?? sp.get('sentimentTheme');
  return {
    case: umDe(sp.get('case'), ['open', 'with', 'none', 'closed', 'all'], PADRAO.case),
    assignee: umDe(sp.get('assignee'), ['any', 'me', 'unassigned'], 'any'),
    due: umDe(sp.get('due'), ['any', 'overdue', 'today', 'next7'], 'any'),
    npsClass: umDe(sp.get('npsClass'), ['any', 'promoter', 'passive', 'detractor'], 'any'),
    sentiment: isSentimentFilterValue(sentiment) ? sentiment : 'any',
    theme: isSentimentThemeFilterValue(theme) ? theme : 'any',
    hasComment: umDe(sp.get('hasComment'), ['any', 'true', 'false'], 'any'),
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    unitId: sp.get('unitId') ?? '',
    q: sp.get('q') ?? '',
  };
}

function paraParams(f: Filtros) {
  const p = new URLSearchParams();
  (Object.keys(PADRAO) as (keyof Filtros)[]).forEach((k) => {
    const v = f[k].trim();
    if (v && v !== PADRAO[k]) p.set(k, v);
  });
  return p;
}

const hojeIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const diasAtrasIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function periodoAtual(f: Filtros) {
  if (!f.from && !f.to) return 'tudo';
  if (f.to === hojeIso()) {
    if (f.from === diasAtrasIso(6)) return '7';
    if (f.from === diasAtrasIso(29)) return '30';
    if (f.from === diasAtrasIso(89)) return '90';
  }
  return 'personalizado';
}

type SentimentoResumo = {
  responses: number;
  classified: number;
  counts: { elogio: number; reclamacao: number; neutro: number };
  percents: { elogio: number; reclamacao: number; neutro: number };
};
type CasosResumo = { totals: { open: number }; due: { overdue: number }; assignees: { unassigned: number } };

// ---------------------------------------------------------------------------

export function FeedbacksTela({ visao }: { visao: 'lista' | 'kanban' }) {
  const [sp, setSp] = useSearchParams();
  const pode = usePode();
  const me = useAuthMe();
  const podeTratar = pode('feedback:manage');
  const kanban = visao === 'kanban';

  const f = useMemo(() => lerFiltros(sp), [sp]);
  const mudar = useCallback(
    (parcial: Partial<Filtros>) => {
      setSp((atual) => paraParams({ ...lerFiltros(atual), ...parcial }), { replace: true });
    },
    [setSp],
  );

  // Busca com pequena espera para não consultar a cada tecla
  const [busca, setBusca] = useState(f.q);
  const ultimaQ = useRef(f.q);
  useEffect(() => {
    if (f.q !== ultimaQ.current) {
      ultimaQ.current = f.q;
      setBusca(f.q);
    }
  }, [f.q]);
  useEffect(() => {
    if (busca === f.q) return;
    const t = setTimeout(() => {
      ultimaQ.current = busca;
      mudar({ q: busca });
    }, 350);
    return () => clearTimeout(t);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toast
  const [toast, setToast] = useState('');
  const toastTempo = useRef<number | undefined>(undefined);
  const avisar = useCallback((texto: string) => {
    setToast(texto);
    window.clearTimeout(toastTempo.current);
    toastTempo.current = window.setTimeout(() => setToast(''), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTempo.current), []);

  // Gaveta
  const [aberto, setAberto] = useState<string | null>(null);

  const unidades = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unidade[]>('/units') });

  // ----- Resumo (KPIs) -----
  const kpiDe = f.from || diasAtrasIso(29);
  const kpiAte = f.to || hojeIso();
  const sentimento = useQuery({
    queryKey: ['metrics', 'sentimentSummary', kpiDe, kpiAte, f.unitId],
    queryFn: () =>
      apiFetch<SentimentoResumo>(
        `/metrics/sentiment/summary?from=${encodeURIComponent(kpiDe)}&to=${encodeURIComponent(kpiAte)}${
          f.unitId ? `&unitId=${encodeURIComponent(f.unitId)}` : ''
        }`,
      ),
    retry: false,
  });
  const casos = useQuery({
    queryKey: ['metrics', 'casesSummary', f.unitId],
    queryFn: () => apiFetch<CasosResumo>(`/metrics/cases/summary${f.unitId ? `?unitId=${encodeURIComponent(f.unitId)}` : ''}`),
    enabled: podeTratar,
    retry: false,
  });

  // ----- Lista -----
  const qsLista = paraParams(f).toString();
  const lista = useInfiniteQuery({
    queryKey: ['feedbacks', qsLista],
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams(qsLista);
      p.set('take', String(POR_PAGINA));
      if (pageParam) p.set('cursor', pageParam);
      return apiFetch<FeedbackItem[]>(`/feedbacks?${p.toString()}`);
    },
    initialPageParam: '' as string,
    getNextPageParam: (ultima) => (ultima.length === POR_PAGINA ? ultima[ultima.length - 1]?.id : undefined),
    enabled: !kanban,
  });
  const itens = useMemo(() => lista.data?.pages.flat() ?? [], [lista.data]);

  // ----- Kanban -----
  const mostrarEncerradas = f.case === 'with' || f.case === 'closed';
  const qsKanban = useMemo(() => {
    const p = new URLSearchParams();
    p.set('case', mostrarEncerradas ? 'with' : 'open');
    if (f.assignee !== 'any') p.set('assignee', f.assignee);
    if (f.due !== 'any') p.set('due', f.due);
    return p.toString();
  }, [f.assignee, f.due, mostrarEncerradas]);
  const quadro = useQuery({
    queryKey: ['kanban', qsKanban],
    queryFn: () => apiFetch<KanbanItem[]>(`/feedbacks/kanban?${qsKanban}`),
    enabled: kanban,
  });
  // O endpoint do Kanban só filtra responsável e prazo; unidade, nota e busca são aplicadas aqui
  const cartoes = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return (quadro.data ?? []).filter((c) => {
      if (f.unitId && c.unit?.id !== f.unitId) return false;
      if (f.npsClass !== 'any' && c.surveyResponse.npsClass !== f.npsClass) return false;
      if (q) {
        const texto = `${c.surveyResponse.mainComment ?? ''} ${c.customer?.name ?? ''} ${c.customer?.email ?? ''} ${
          c.customer?.phone ?? ''
        } ${c.unit?.name ?? ''} ${c.assignee?.name ?? ''}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [quadro.data, f.unitId, f.npsClass, f.q]);

  const qc = useQueryClient();
  const mover = useMutation({
    mutationFn: (p: { responseId: string; status: string }) =>
      apiFetch(`/feedbacks/${p.responseId}/case`, { method: 'PATCH', json: { status: p.status } }),
    onSuccess: (_r, p) => avisar(`Movido para ${etapaRotulo(p.status)}`),
    onError: () => avisar('Não foi possível mover o feedback'),
    onSettled: async (_r, _e, p) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['kanban'] }),
        qc.invalidateQueries({ queryKey: ['feedbacks'] }),
        qc.invalidateQueries({ queryKey: ['feedback', p.responseId] }),
        qc.invalidateQueries({ queryKey: ['metrics', 'casesSummary'] }),
        qc.invalidateQueries({ queryKey: ['shellCasesSummary'] }),
      ]);
    },
  });
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);

  const colunas = mostrarEncerradas ? [...ETAPAS] : ETAPAS.slice(0, 5);

  // ----- Navegação Lista | Kanban (mantém os filtros) -----
  const qsAtual = sp.toString();
  const linkLista = `/app/feedbacks${qsAtual ? `?${qsAtual}` : ''}`;
  const linkKanban = `/app/feedbacks/kanban${qsAtual ? `?${qsAtual}` : ''}`;
  const atalho = (parcial: Partial<Filtros>) => {
    const p = paraParams({ ...PADRAO, from: f.from, to: f.to, unitId: f.unitId, ...parcial }).toString();
    return `/app/feedbacks${p ? `?${p}` : ''}`;
  };

  const periodo = periodoAtual(f);
  const rotuloPeriodo =
    !f.from && !f.to
      ? 'Últimos 30 dias'
      : periodo === '7'
        ? 'Últimos 7 dias'
        : periodo === '30'
          ? 'Últimos 30 dias'
          : periodo === '90'
            ? 'Últimos 90 dias'
            : `${f.from ? new Date(`${f.from}T12:00`).toLocaleDateString('pt-BR') : '…'} a ${
                f.to ? new Date(`${f.to}T12:00`).toLocaleDateString('pt-BR') : 'hoje'
              }`;
  const nomeUnidade = unidades.data?.find((u) => u.id === f.unitId)?.name;

  function limpar() {
    setBusca('');
    ultimaQ.current = '';
    const manter: Partial<Filtros> = { from: f.from, to: f.to };
    if (kanban && mostrarEncerradas) manter.case = 'with';
    setSp(paraParams({ ...PADRAO, ...manter }), { replace: true });
  }

  const total = kanban ? cartoes.length : itens.length;
  const carregando = kanban ? quadro.isLoading : lista.isLoading;
  const erro = kanban ? quadro.isError : lista.isError;

  return (
    <div className="fbx" data-feedbacks>
      <div className="cabeca">
        <div>
          <h1 className="cabeca__titulo">Feedbacks</h1>
          <p className="cabeca__desc">
            Todas as respostas das pesquisas: elogios, sugestões e reclamações. As que pedem ação têm responsável e prazo.
          </p>
        </div>
        <div className="cabeca__acoes">
          {!kanban && (
            <div className="campo">
              <label htmlFor="fb-periodo">Período</label>
              <select
                id="fb-periodo"
                value={periodo}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'tudo') mudar({ from: '', to: '' });
                  else if (v === '7') mudar({ from: diasAtrasIso(6), to: hojeIso() });
                  else if (v === '30') mudar({ from: diasAtrasIso(29), to: hojeIso() });
                  else if (v === '90') mudar({ from: diasAtrasIso(89), to: hojeIso() });
                  else document.getElementById('fb-de')?.focus();
                }}
              >
                <option value="tudo">Todo o período</option>
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
          )}
          <nav className="alternar" aria-label="Forma de ver">
            <Link to={linkLista} aria-current={!kanban ? 'page' : undefined}>
              <Icone nome="lista" />
              Lista
            </Link>
            <Link to={linkKanban} aria-current={kanban ? 'page' : undefined}>
              <Icone nome="ocorrencias" />
              Kanban
            </Link>
          </nav>
        </div>
      </div>

      <section className="kpis" aria-label="Resumo dos feedbacks">
        <article className="kpi">
          <p className="kpi__rotulo">Respostas</p>
          <p className="kpi__valor">{sentimento.data ? sentimento.data.responses.toLocaleString('pt-BR') : '—'}</p>
          <p className="kpi__nota">
            {rotuloPeriodo}
            {nomeUnidade ? ` · ${nomeUnidade}` : ''}
          </p>
        </article>
        <article className="kpi">
          <Link className="kpi__rotulo kpi__link" to={atalho({ sentiment: 'elogio' })}>
            Elogios
          </Link>
          <p className="kpi__valor fb-kpi--elogio">{sentimento.data ? `${sentimento.data.percents.elogio}%` : '—'}</p>
          <p className="kpi__nota">{sentimento.data ? `${sentimento.data.counts.elogio} dos comentários` : ' '}</p>
        </article>
        <article className="kpi">
          <Link className="kpi__rotulo kpi__link" to={atalho({ sentiment: 'reclamacao' })}>
            Reclamações
          </Link>
          <p className="kpi__valor fb-kpi--reclamacao">{sentimento.data ? `${sentimento.data.percents.reclamacao}%` : '—'}</p>
          <p className="kpi__nota">{sentimento.data ? `${sentimento.data.counts.reclamacao} dos comentários` : ' '}</p>
        </article>
        {podeTratar ? (
          <article className={`kpi${casos.data?.due.overdue ? ' kpi--alerta' : ''}`}>
            <Link className="kpi__rotulo kpi__link" to={atalho({ case: 'open' })}>
              Precisam de ação
            </Link>
            <p className="kpi__valor">{casos.data ? casos.data.totals.open : '—'}</p>
            <p className="kpi__nota">
              {casos.data
                ? casos.data.due.overdue
                  ? `${casos.data.due.overdue} ${casos.data.due.overdue === 1 ? 'vencida' : 'vencidas'}. Resolva primeiro.`
                  : 'Nenhuma fora do prazo'
                : ' '}
            </p>
          </article>
        ) : (
          <article className="kpi">
            <Link className="kpi__rotulo kpi__link" to={atalho({ sentiment: 'neutro' })}>
              Neutros
            </Link>
            <p className="kpi__valor">{sentimento.data ? `${sentimento.data.percents.neutro}%` : '—'}</p>
            <p className="kpi__nota">{sentimento.data ? `${sentimento.data.counts.neutro} dos comentários` : ' '}</p>
          </article>
        )}
      </section>

      <section className="cartao" aria-label="Filtros">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          {!kanban && (
            <div className="campo">
              <label htmlFor="fb-acao">Tratamento</label>
              <select id="fb-acao" value={f.case} onChange={(e) => mudar({ case: e.target.value })}>
                <option value="all">Todos os feedbacks</option>
                <option value="open">Precisa de ação</option>
                <option value="with">Com ocorrência</option>
                <option value="closed">Resolvidas/encerradas</option>
                <option value="none">Sem ocorrência</option>
              </select>
            </div>
          )}
          <div className="campo campo--busca">
            <label htmlFor="fb-busca">Buscar</label>
            <input
              id="fb-busca"
              type="search"
              placeholder="Palavra do comentário ou nome do cliente"
              autoComplete="off"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Icone nome="busca" />
          </div>
          <div className="campo">
            <label htmlFor="fb-unidade">Unidade</label>
            <select id="fb-unidade" value={f.unitId} onChange={(e) => mudar({ unitId: e.target.value })} disabled={unidades.isLoading}>
              <option value="">Todas</option>
              {unidades.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fb-nota">Nota</label>
            <select id="fb-nota" value={f.npsClass} onChange={(e) => mudar({ npsClass: e.target.value })}>
              <option value="any">Todas</option>
              <option value="promoter">Promotores (9–10)</option>
              <option value="passive">Passivos (7–8)</option>
              <option value="detractor">Detratores (1–6)</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fb-responsavel">Responsável</label>
            <select id="fb-responsavel" value={f.assignee} onChange={(e) => mudar({ assignee: e.target.value })}>
              <option value="any">Todos</option>
              <option value="me">Atribuídas a mim</option>
              <option value="unassigned">Sem responsável</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fb-prazo">Prazo</label>
            <select id="fb-prazo" value={f.due} onChange={(e) => mudar({ due: e.target.value })}>
              <option value="any">Todos</option>
              <option value="overdue">Vencidas</option>
              <option value="today">Vencem hoje</option>
              <option value="next7">Próx. 7 dias</option>
            </select>
          </div>
          {!kanban && (
            <>
              <div className="campo">
                <label htmlFor="fb-tipo">
                  O que diz{' '}
                  <span className="selo-ia">
                    <Icone nome="ia" />
                    IA
                  </span>
                </label>
                <select id="fb-tipo" value={f.sentiment} onChange={(e) => mudar({ sentiment: e.target.value })}>
                  <option value="any">Tudo</option>
                  {SENTIMENT_FILTER_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {v === 'elogio' ? 'Elogios' : v === 'reclamacao' ? 'Reclamações' : 'Neutros'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="fb-tema">
                  Tema{' '}
                  <span className="selo-ia">
                    <Icone nome="ia" />
                    IA
                  </span>
                </label>
                <select id="fb-tema" value={f.theme} onChange={(e) => mudar({ theme: e.target.value })}>
                  <option value="any">Todos</option>
                  {SENTIMENT_THEME_FILTER_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {sentimentThemeLabel(v)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="fb-comentario">Comentário</label>
                <select id="fb-comentario" value={f.hasComment} onChange={(e) => mudar({ hasComment: e.target.value })}>
                  <option value="any">Com e sem comentário</option>
                  <option value="true">Só com comentário</option>
                  <option value="false">Só a nota</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="fb-de">De</label>
                <input id="fb-de" type="date" value={f.from} max={f.to || undefined} onChange={(e) => mudar({ from: e.target.value })} />
              </div>
              <div className="campo">
                <label htmlFor="fb-ate">Até</label>
                <input id="fb-ate" type="date" value={f.to} min={f.from || undefined} onChange={(e) => mudar({ to: e.target.value })} />
              </div>
            </>
          )}
          {kanban && (
            <div className="campo fbx-campo-marcar">
              <label className="marcar">
                <input
                  type="checkbox"
                  checked={mostrarEncerradas}
                  onChange={(e) => mudar({ case: e.target.checked ? 'with' : 'open' })}
                />
                Mostrar encerradas e descartadas
              </label>
            </div>
          )}
        </form>
        <div className="filtros__rodape">
          <p className="filtros__contagem" role="status" aria-live="polite">
            {carregando ? (
              'Carregando…'
            ) : (
              <>
                <strong>
                  {total}
                  {!kanban && lista.hasNextPage ? '+' : ''}
                </strong>{' '}
                {total === 1 ? 'feedback' : 'feedbacks'}
                {kanban ? ' que pedem ou pediram ação' : ''}
              </>
            )}
          </p>
          <button className="btn btn--fantasma" type="button" onClick={limpar}>
            Limpar filtros
          </button>
        </div>
      </section>

      {erro && (
        <div className="cartao vazio" role="alert">
          <strong>Falha ao carregar</strong>Tente de novo em instantes.
        </div>
      )}

      {!kanban && !erro && (
        <div className="fbx-lista-area">
          {itens.length > 0 && (
            <ul className="fb-lista" aria-label="Respostas">
              {itens.map((r) => (
                <ItemLista key={r.id} r={r} podeTratar={podeTratar} meuId={me.data?.id} abrir={setAberto} />
              ))}
            </ul>
          )}
          {!lista.isLoading && itens.length === 0 && (
            <div className="cartao vazio">
              <strong>Nenhum feedback com esses filtros</strong>Tente outro período ou clique em "Limpar filtros".
            </div>
          )}
          {lista.hasNextPage && (
            <button
              className="btn btn--secundario fb-mais"
              type="button"
              disabled={lista.isFetchingNextPage}
              onClick={() => void lista.fetchNextPage()}
            >
              {lista.isFetchingNextPage ? 'Carregando…' : 'Mostrar mais'}
            </button>
          )}
        </div>
      )}

      {kanban && !erro && !quadro.isLoading && (
        <div className="quadro" aria-label="Kanban do tratamento">
          {colunas.map((status) => {
            const daEtapa = cartoes.filter((c) => c.status === status);
            const id = `coluna-${status}`;
            return (
              <section
                key={status}
                className={`coluna${colunaAlvo === status ? ' fbx-coluna--alvo' : ''}`}
                aria-labelledby={id}
                onDragOver={(e) => {
                  if (!podeTratar) return;
                  e.preventDefault();
                  if (colunaAlvo !== status) setColunaAlvo(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setColunaAlvo(null);
                }}
                onDrop={(e) => {
                  setColunaAlvo(null);
                  if (!podeTratar) return;
                  const responseId = e.dataTransfer.getData('text/responseId');
                  const de = e.dataTransfer.getData('text/status');
                  if (!responseId || de === status) return;
                  mover.mutate({ responseId, status });
                }}
              >
                <div className="coluna__topo">
                  <h2 className={classeEtapa(status)} id={id}>
                    {etapaRotulo(status)}
                  </h2>
                  <span className="coluna__total">
                    {daEtapa.length}
                    <span className="visualmente-oculto"> feedbacks</span>
                  </span>
                </div>
                {daEtapa.length ? (
                  <ul className="coluna__lista">
                    {daEtapa.map((c) => (
                      <CartaoKanban key={c.id} c={c} podeTratar={podeTratar} meuId={me.data?.id} abrir={setAberto} />
                    ))}
                  </ul>
                ) : (
                  <p className="coluna__vazia">Nada aqui</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {podeTratar && <GavetaTratamento responseId={aberto} onFechar={() => setAberto(null)} avisar={avisar} />}

      <p className="toast" role="status" aria-live="polite" data-oculto={toast ? undefined : ''}>
        {toast}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ItemLista({
  r,
  podeTratar,
  meuId,
  abrir,
}: {
  r: FeedbackItem;
  podeTratar: boolean;
  meuId?: string;
  abrir: (id: string) => void;
}) {
  const oc = r.feedbackCase;
  const aberta = oc && ['new', 'viewed', 'in_progress', 'waiting_customer'].includes(oc.status);
  const p = oc ? prazoInfo(oc.status, oc.dueAt) : null;
  const meta = [
    r.unit?.name,
    r.employee?.name ? `Atendente: ${r.employee.name}` : null,
    r.customer ? nomeCliente(r.customer) : null,
  ].filter(Boolean) as string[];

  return (
    <li className={`cartao fb-item${aberta && podeTratar ? ' fb-item--acao' : ''}`}>
      <span
        className={classeNota(r.npsClass)}
        aria-label={r.npsScore != null ? `Nota ${r.npsScore} de 1 a 10 (${rotuloClasseNps(r.npsClass)})` : 'Sem nota'}
      >
        {r.npsScore ?? '—'}
      </span>
      <div className="fb-item__corpo">
        {r.mainComment?.trim() ? (
          <p className="fb-item__texto">“{r.mainComment.trim()}”</p>
        ) : (
          <p className="fb-item__sem">Sem comentário: só a nota.</p>
        )}
        <p className="fb-item__meta">
          {meta.map((m, i) => (
            <span key={i}>
              {m}
              <span aria-hidden="true"> · </span>
            </span>
          ))}
          <time dateTime={r.completedAt ?? undefined} title={dataCompleta(r.completedAt)}>
            {dataHora(r.completedAt)}
          </time>
        </p>
        <div className="fb-item__tags">
          {r.sentiment && <span className={`fb-tag fb-tag--${r.sentiment}`}>{sentimentLabel(r.sentiment)}</span>}
          {r.sentimentTheme && <span className="fb-tag">{sentimentThemeLabel(r.sentimentTheme)}</span>}
          {!oc && (
            <Link className="fb-oc fbx-detalhes" to={`/app/feedbacks/${r.id}`}>
              Ver detalhes<span className="visualmente-oculto"> do feedback {r.id.slice(0, 8)}</span>
            </Link>
          )}
        </div>
        {oc && p && (
          <div className="fb-trat">
            <span className={classeEtapa(oc.status)}>{etapaRotulo(oc.status)}</span>
            <Responsavel nome={oc.assignee?.name} eu={Boolean(meuId) && oc.assigneeUserId === meuId} />
            {aberta && (
              <span className={p.classe}>
                <Icone nome="relogio" />
                {p.texto}
              </span>
            )}
            {oc.priority !== 'normal' && <span className={`fb-tag fbx-prio--${oc.priority}`}>Prioridade {prioridadeRotulo(oc.priority).toLowerCase()}</span>}
            <span className="fbx-trat-acoes">
              <Link className="btn btn--fantasma" to={`/app/feedbacks/${r.id}`}>
                Detalhes<span className="visualmente-oculto"> do feedback {r.id.slice(0, 8)}</span>
              </Link>
              {podeTratar && (
                <button className="btn btn--secundario fb-trat__abrir" type="button" aria-haspopup="dialog" onClick={() => abrir(r.id)}>
                  Tratar<span className="visualmente-oculto"> o feedback {r.id.slice(0, 8)}</span>
                </button>
              )}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

function CartaoKanban({
  c,
  podeTratar,
  meuId,
  abrir,
}: {
  c: KanbanItem;
  podeTratar: boolean;
  meuId?: string;
  abrir: (id: string) => void;
}) {
  const r = c.surveyResponse;
  const p = prazoInfo(c.status, c.dueAt);
  const conteudo = (
    <>
      <span className="oc-cartao__topo">
        <span className={classeNota(r.npsClass)}>
          <span className="visualmente-oculto">Nota </span>
          {r.npsScore ?? '—'}
        </span>
        <span className="oc-cartao__id">
          {rotuloClasseNps(r.npsClass)} · #{r.id.slice(0, 8)}
        </span>
      </span>
      <span className="oc-cartao__texto">{r.mainComment?.trim() || 'Sem comentário'}</span>
      <span className="oc-cartao__meta">
        <span className="oc-cartao__unidade">
          <Icone nome="loja" />
          {c.unit?.name ?? '—'}
        </span>
        <span className={p.classe || 'prazo'}>
          <Icone nome="relogio" />
          {p.texto}
        </span>
      </span>
      <span className="oc-cartao__meta">
        <Responsavel nome={c.assignee?.name} eu={Boolean(meuId) && c.assigneeUserId === meuId} />
        <span className={`fb-tag fbx-prio--${c.priority}`}>{prioridadeRotulo(c.priority)}</span>
      </span>
      <span className="oc-cartao__meta">
        <span>{nomeCliente(c.customer)}</span>
        {c.customer?.doNotContact && <span className="fb-tag fb-tag--reclamacao">Não contatar</span>}
      </span>
    </>
  );
  return (
    <li
      draggable={podeTratar}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/responseId', r.id);
        e.dataTransfer.setData('text/status', c.status);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={podeTratar ? 'fbx-arrastavel' : undefined}
    >
      {podeTratar ? (
        // div com role="button": no Firefox, um <button> dentro de item arrastável não inicia o arrasto
        <div
          className="oc-cartao"
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          onClick={() => abrir(r.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              abrir(r.id);
            }
          }}
        >
          {conteudo}
        </div>
      ) : (
        <Link className="oc-cartao" to={`/app/feedbacks/${r.id}`}>
          {conteudo}
        </Link>
      )}
    </li>
  );
}
