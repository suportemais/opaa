import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import type { WhistleblowerSummary } from '../lib/api-novos';
import { whistleblowerCategoryLabel, whistleblowerPriorityLabel, whistleblowerStatusLabel } from '../lib/labels';
import { Icone } from '../components/painel/Icone';
import {
  CATEGORIAS,
  PRIORIDADES,
  SITUACOES,
  categoriaTexto,
  ordenarDenuncias,
  quando,
  dataHora,
  type DenunciaLinha,
} from '../components/painel/denuncias/comum';
import { SeloIdent, SeloPrioridade, SeloSituacao } from '../components/painel/denuncias/Selos';
import { useAviso } from '../components/painel/denuncias/useAviso';
import { DenunciaGaveta } from '../components/painel/denuncias/DenunciaGaveta';
import { DivulgarGaveta } from '../components/painel/denuncias/DivulgarGaveta';
import '../styles/painel-denuncias.css';

type Unit = { id: string; name: string };
type TenantMe = { id: string; slug: string; tradeName: string; legalName: string };

const LIMITE = 200;

/** Filtros e valores padrão (só o que difere do padrão vai para o endereço). */
const PADRAO = {
  q: '',
  status: 'open',
  priority: 'any',
  category: 'any',
  unitId: '',
  identified: 'any',
  from: '',
  to: '',
};
type Filtros = typeof PADRAO;

export function DenunciasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [f, setF] = useState<Filtros>(() => {
    const inicial = { ...PADRAO };
    (Object.keys(PADRAO) as Array<keyof Filtros>).forEach((k) => {
      const v = searchParams.get(k);
      if (v !== null) inicial[k] = v;
    });
    return inicial;
  });
  const [abertaId, setAbertaId] = useState<string | null>(() => searchParams.get('abrir'));
  const [divulgarAberta, setDivulgarAberta] = useState(false);
  const ultimoGatilho = useRef<string | null>(null);
  const botaoDivulgar = useRef<HTMLButtonElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const { avisar, elemento: aviso } = useAviso();

  const set = (k: keyof Filtros) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });
  const tenant = useQuery({ queryKey: ['tenantMe'], queryFn: () => apiFetch<TenantMe>('/tenant/me') });

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (f.status) p.set('status', f.status);
    if (f.priority !== 'any') p.set('priority', f.priority);
    if (f.category !== 'any') p.set('category', f.category);
    if (f.identified !== 'any') p.set('identified', f.identified);
    if (f.from) p.set('from', f.from);
    if (f.to) p.set('to', f.to);
    if (f.unitId) p.set('unitId', f.unitId);
    if (f.q.trim()) p.set('q', f.q.trim());
    p.set('take', String(LIMITE));
    return `?${p.toString()}`;
  }, [f]);

  // Filtros no endereço (dá para voltar ao mesmo recorte)
  useEffect(() => {
    const p = new URLSearchParams();
    (Object.keys(PADRAO) as Array<keyof Filtros>).forEach((k) => {
      if (f[k] !== PADRAO[k]) p.set(k, f[k]);
    });
    if (abertaId) p.set('abrir', abertaId);
    setSearchParams(p, { replace: true });
  }, [f, abertaId, setSearchParams]);

  const rows = useQuery({
    queryKey: ['whistleblower', queryString],
    queryFn: () => apiFetch<DenunciaLinha[]>(`/whistleblower${queryString}`),
  });

  const resumo = useQuery({
    queryKey: ['whistleblowerSummary', f.unitId],
    queryFn: () =>
      apiFetch<WhistleblowerSummary>(`/whistleblower/summary${f.unitId ? `?unitId=${encodeURIComponent(f.unitId)}` : ''}`),
  });

  const itens = useMemo(() => ordenarDenuncias(rows.data ?? []), [rows.data]);
  const filtrosAlterados = (Object.keys(PADRAO) as Array<keyof Filtros>).some((k) => f[k] !== PADRAO[k]);

  function abrir(id: string) {
    ultimoGatilho.current = id;
    setAbertaId(id);
  }

  function aoFecharDetalhe() {
    setAbertaId(null);
    const id = ultimoGatilho.current;
    if (id) document.querySelector<HTMLButtonElement>(`[data-den-abrir="${id}"]`)?.focus();
  }

  const r = resumo.data;
  const valor = (n: number | undefined) => (resumo.isLoading ? '…' : resumo.isError ? '—' : (n ?? 0));

  return (
    <>
      <div className="cabeca">
        <div>
          <h1 className="cabeca__titulo">Denúncias</h1>
          <p className="cabeca__desc">Relatos do canal de ética, enviados pela equipe. Ficam separados das pesquisas de clientes.</p>
        </div>
        <button
          ref={botaoDivulgar}
          className="btn btn--secundario"
          type="button"
          aria-haspopup="dialog"
          onClick={() => setDivulgarAberta(true)}
        >
          <Icone nome="link" />
          Divulgar o canal
        </button>
      </div>

      <p className="den-sigilo">
        <Icone nome="cadeado" />
        <span>
          <strong>Confidencial.</strong> Só os perfis com acesso a Denúncias veem esta tela. Não compartilhe os relatos fora da equipe
          responsável.
        </span>
      </p>

      <section className="kpis" aria-label="Resumo das denúncias">
        <article className="kpi">
          <p className="kpi__rotulo">Novas</p>
          <p className="kpi__valor">{valor(r?.novas)}</p>
          <p className="kpi__nota">Ainda sem análise</p>
        </article>
        <article className="kpi">
          <p className="kpi__rotulo">Em andamento</p>
          <p className="kpi__valor">{valor(r?.emAndamento)}</p>
          <p className="kpi__nota">Em análise, investigação ou aguardando informações</p>
        </article>
        <article className={`kpi${r && r.altaCritica > 0 ? ' kpi--alerta' : ''}`}>
          <p className="kpi__rotulo">Prioridade alta ou crítica</p>
          <p className="kpi__valor">{valor(r?.altaCritica)}</p>
          <p className="kpi__nota">{r && r.altaCritica > 0 ? 'Em aberto. Trate primeiro.' : 'Nenhuma em aberto'}</p>
        </article>
        <article className="kpi">
          <p className="kpi__rotulo">Concluídas</p>
          <p className="kpi__valor">{valor(r?.concluidas90d)}</p>
          <p className="kpi__nota">Nos últimos 90 dias</p>
        </article>
      </section>

      <section className="cartao" aria-label="Filtros">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          <div className="campo campo--busca">
            <label htmlFor="d-busca">Buscar</label>
            <input
              id="d-busca"
              ref={buscaRef}
              type="search"
              placeholder="Protocolo, texto do relato ou denunciante"
              autoComplete="off"
              value={f.q}
              onChange={set('q')}
            />
            <Icone nome="busca" />
          </div>
          <div className="campo">
            <label htmlFor="d-situacao">Situação</label>
            <select id="d-situacao" value={f.status} onChange={set('status')}>
              <option value="open">Em aberto</option>
              <option value="any">Todas</option>
              {SITUACOES.map((s) => (
                <option key={s} value={s}>
                  {whistleblowerStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="d-prioridade">Prioridade</label>
            <select id="d-prioridade" value={f.priority} onChange={set('priority')}>
              <option value="any">Todas</option>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {whistleblowerPriorityLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="d-categoria">Categoria</label>
            <select id="d-categoria" value={f.category} onChange={set('category')}>
              <option value="any">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {whistleblowerCategoryLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="d-unidade">Unidade</label>
            <select id="d-unidade" value={f.unitId} onChange={set('unitId')} disabled={units.isLoading}>
              <option value="">Todas</option>
              {units.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="d-ident">Identificação</label>
            <select id="d-ident" value={f.identified} onChange={set('identified')}>
              <option value="any">Todas</option>
              <option value="anonymous">Anônimas</option>
              <option value="identified">Identificadas</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="d-de">Recebidas de</label>
            <input id="d-de" type="date" value={f.from} onChange={set('from')} max={f.to || undefined} />
          </div>
          <div className="campo">
            <label htmlFor="d-ate">Até</label>
            <input id="d-ate" type="date" value={f.to} onChange={set('to')} min={f.from || undefined} />
          </div>
        </form>
        <div className="filtros__rodape">
          <p className="filtros__contagem" role="status" aria-live="polite">
            {rows.data ? (
              <>
                <strong>{itens.length}</strong> {itens.length === 1 ? 'denúncia' : 'denúncias'}
                {itens.length >= LIMITE ? ` (as ${LIMITE} mais recentes; refine os filtros)` : ''}
              </>
            ) : rows.isLoading ? (
              'Carregando…'
            ) : (
              ''
            )}
          </p>
          <button
            className="btn btn--fantasma"
            type="button"
            disabled={!filtrosAlterados}
            onClick={() => {
              setF({ ...PADRAO });
              buscaRef.current?.focus();
            }}
          >
            Limpar filtros
          </button>
        </div>
      </section>

      <section className="cartao" aria-label="Lista de denúncias">
        {rows.isError && (
          <p className="cli__erro cli__erro--geral" role="alert">
            Falha ao carregar denúncias.
          </p>
        )}
        {rows.isLoading && <p className="vazio">Carregando…</p>}
        {rows.data && itens.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela oc-tabela den-tabela">
              <thead>
                <tr>
                  <th scope="col">Prioridade</th>
                  <th scope="col">Denúncia</th>
                  <th scope="col">Unidade</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Identificação</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((d) => (
                  <tr key={d.id}>
                    <td data-col="nota">
                      <SeloPrioridade priority={d.priority} />
                    </td>
                    <td data-col="comentario">
                      <button
                        className="oc-abrir"
                        type="button"
                        data-den-abrir={d.id}
                        aria-haspopup="dialog"
                        onClick={() => abrir(d.id)}
                      >
                        <span className="oc-abrir__texto">{d.title}</span>
                        <span className="oc-abrir__meta">
                          {d.protocol} · {categoriaTexto(d)} ·{' '}
                          <time dateTime={d.createdAt} title={dataHora(d.createdAt)}>
                            {quando(d.createdAt)}
                          </time>
                          {d.assignee ? ` · Resp.: ${d.assignee.name}` : ''}
                        </span>
                      </button>
                    </td>
                    <td data-col="unidade">{d.unit?.name ?? 'Não informada'}</td>
                    <td data-col="etapa">
                      <SeloSituacao status={d.status} />
                    </td>
                    <td data-col="responsavel">
                      <span className="den-ident-celula">
                        <SeloIdent anonima={d.reporterAnonymous} />
                        {!d.reporterAnonymous && (d.reporterName || d.reporterEmail || d.reporterPhone) && (
                          <span className="den-contato">{d.reporterName ?? d.reporterEmail ?? d.reporterPhone}</span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.data && itens.length === 0 && (
          <p className="vazio">
            <strong>Nenhuma denúncia com esses filtros</strong>
            Escolha "Todas" em Situação ou clique em "Limpar filtros".
          </p>
        )}
      </section>

      <DenunciaGaveta id={abertaId} onFechar={aoFecharDetalhe} avisar={avisar} />
      <DivulgarGaveta
        aberta={divulgarAberta}
        onFechar={() => {
          setDivulgarAberta(false);
          botaoDivulgar.current?.focus();
        }}
        slug={tenant.data?.slug ?? ''}
        empresa={tenant.data?.tradeName ?? ''}
        carregando={tenant.isLoading}
        erro={tenant.isError}
        avisar={avisar}
      />
      {aviso}
    </>
  );
}
