import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import type { CustomerListPage } from '../lib/api-novos';
import { Icone } from '../components/painel/Icone';
import { usePode } from '../components/painel/usePainel';
import { useAviso } from '../components/painel/clientes/Aviso';
import { ClienteGavetaConteudo, NotaSelo } from '../components/painel/clientes/ClienteGaveta';
import { ExportarConteudo } from '../components/painel/clientes/ExportarGaveta';
import { Gaveta } from '../components/painel/clientes/Gaveta';
import { ImportarConteudo } from '../components/painel/clientes/ImportarGaveta';
import { NovoClienteConteudo } from '../components/painel/clientes/NovoClienteGaveta';
import {
  type Cliente,
  ORIGEM_ROTULO,
  aniversario,
  baixarModeloImportacao,
  mesNascimento,
  nomeDoMes,
  quando,
  useUnidadesPermitidas,
} from '../components/painel/clientes/util';
import '../styles/painel-clientes.css';

const POR_PAGINA = 50;
const FILTROS = ['q', 'unidade', 'ofertas', 'aniversario', 'origem'] as const;

const MES_ATUAL = new Date().getMonth() + 1;
const MES_QUE_VEM = (MES_ATUAL % 12) + 1;

const contar = (p: URLSearchParams) => {
  const q = new URLSearchParams(p);
  q.set('page', '1');
  q.set('pageSize', '1');
  return apiFetch<CustomerListPage<Cliente>>(`/customers?${q}`).then((r) => r.total);
};

type Gavetas = 'novo' | 'importar' | 'exportar' | null;

export function CustomersPage() {
  const pode = usePode();
  const podeEditar = pode('customer:manage');
  const podeVerRespostas = pode('response:read');
  const [params, setParams] = useSearchParams();
  const [aviso, avisar] = useAviso();
  const { unidades, todas } = useUnidadesPermitidas();
  const [gaveta, setGaveta] = useState<Gavetas>(null);

  const estado = {
    q: params.get('q') ?? '',
    unidade: params.get('unidade') ?? '',
    ofertas: params.get('ofertas') ?? '',
    aniversario: params.get('aniversario') ?? '',
    origem: params.get('origem') ?? '',
  };
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const abrir = params.get('abrir');

  // Busca: digita livre e aplica depois de uma pausa.
  const [busca, setBusca] = useState(estado.q);
  useEffect(() => setBusca((b) => (b.trim() === estado.q ? b : estado.q)), [estado.q]);
  useEffect(() => {
    if (busca.trim() === estado.q) return;
    const t = window.setTimeout(() => mudar({ q: busca.trim() }), 300);
    return () => window.clearTimeout(t);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps

  function mudar(novos: Partial<Record<(typeof FILTROS)[number] | 'pagina' | 'abrir', string>>, manterPagina = false) {
    setParams(
      (atual) => {
        const p = new URLSearchParams(atual);
        for (const [k, v] of Object.entries(novos)) {
          if (v) p.set(k, v);
          else p.delete(k);
        }
        if (!manterPagina && !('pagina' in novos)) p.delete('pagina');
        return p;
      },
      { replace: true },
    );
  }

  /** Filtros da lista no formato da API. */
  const filtrosApi = useMemo(() => {
    const p = new URLSearchParams();
    if (estado.q) p.set('q', estado.q);
    if (estado.unidade) p.set('unitId', estado.unidade);
    if (estado.ofertas === 'sim' || estado.ofertas === 'nao') p.set('offers', estado.ofertas);
    if (estado.aniversario === 'mes') p.set('birthdayMonth', String(MES_ATUAL));
    if (estado.aniversario === 'proximo') p.set('birthdayMonth', String(MES_QUE_VEM));
    if (estado.origem) p.set('source', estado.origem);
    return p;
  }, [estado.q, estado.unidade, estado.ofertas, estado.aniversario, estado.origem]);
  const filtrosTexto = filtrosApi.toString();
  const temFiltro = FILTROS.some((k) => estado[k]);

  const lista = useQuery({
    queryKey: ['customers', 'pagina', filtrosTexto, pagina],
    queryFn: () => {
      const p = new URLSearchParams(filtrosApi);
      p.set('page', String(pagina));
      p.set('pageSize', String(POR_PAGINA));
      return apiFetch<CustomerListPage<Cliente>>(`/customers?${p}`);
    },
    placeholderData: keepPreviousData,
  });

  // Resumo (contagens pela própria API, com page/pageSize=1)
  const [kTotal, kOfertas, kAniv, kPlanilha] = useQueries({
    queries: [
      new URLSearchParams(),
      new URLSearchParams({ offers: 'sim' }),
      new URLSearchParams({ birthdayMonth: String(MES_ATUAL) }),
      new URLSearchParams({ source: 'import' }),
    ].map((p) => ({ queryKey: ['customers', 'contagem', p.toString()], queryFn: () => contar(p) })),
  });
  const n = (v?: number) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : '—');
  const pct =
    typeof kTotal.data === 'number' && typeof kOfertas.data === 'number' && kTotal.data > 0
      ? Math.round((kOfertas.data / kTotal.data) * 100)
      : 0;

  const total = lista.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const itens = lista.data?.items ?? [];

  function limpar() {
    setBusca('');
    setParams(new URLSearchParams(), { replace: true });
    document.getElementById('c-busca')?.focus();
  }

  return (
    <>
      <div className="cabeca">
        <div>
          <h1 className="cabeca__titulo">Clientes</h1>
          <p className="cabeca__desc">Quem deixou o contato na pesquisa (é opcional), entrou por planilha ou foi cadastrado pela equipe.</p>
        </div>
        <div className="cabeca__acoes">
          {podeEditar ? (
            <>
              <button className="btn btn--secundario" type="button" aria-haspopup="dialog" onClick={() => setGaveta('importar')}>
                Importar planilha
              </button>
              <button className="btn btn--secundario" type="button" aria-haspopup="dialog" onClick={() => setGaveta('exportar')}>
                Exportar
              </button>
              <button className="btn btn--primario" type="button" aria-haspopup="dialog" onClick={() => setGaveta('novo')}>
                <Icone nome="mais" />
                Novo cliente
              </button>
            </>
          ) : (
            <>
              <button className="btn btn--fantasma" type="button" onClick={baixarModeloImportacao}>
                Baixar modelo
              </button>
              <button className="btn btn--secundario" type="button" aria-haspopup="dialog" onClick={() => setGaveta('exportar')}>
                Exportar
              </button>
            </>
          )}
        </div>
      </div>

      <section className="kpis" aria-label="Resumo dos clientes">
        <article className="kpi">
          <p className="kpi__rotulo">Clientes cadastrados</p>
          <p className="kpi__valor">{n(kTotal.data)}</p>
          <p className="kpi__nota">Nas unidades que você vê</p>
        </article>
        <article className="kpi">
          <p className="kpi__rotulo">Aceitam receber ofertas</p>
          <p className="kpi__valor">{pct}%</p>
          <p className="kpi__nota">
            {n(kOfertas.data)} de {n(kTotal.data)} clientes
          </p>
        </article>
        <article className="kpi">
          <a
            className="kpi__rotulo kpi__link"
            href="?aniversario=mes"
            onClick={(e) => {
              e.preventDefault();
              setBusca('');
              setParams(new URLSearchParams({ aniversario: 'mes' }), { replace: true });
              document.getElementById('c-contagem')?.scrollIntoView({ block: 'center' });
            }}
          >
            Aniversariantes de {nomeDoMes(MES_ATUAL)}
          </a>
          <p className="kpi__valor">{n(kAniv.data)}</p>
          <p className="kpi__nota">Ver quem são</p>
        </article>
        <article className="kpi">
          <p className="kpi__rotulo">Vieram por planilha</p>
          <p className="kpi__valor">{n(kPlanilha.data)}</p>
          <p className="kpi__nota">Importados pela equipe</p>
        </article>
      </section>

      <section className="cartao" aria-label="Filtros">
        <form className="filtros" onSubmit={(e) => e.preventDefault()}>
          <div className="campo campo--busca">
            <label htmlFor="c-busca">Buscar</label>
            <input
              id="c-busca"
              type="search"
              placeholder="Nome, e-mail ou telefone"
              autoComplete="off"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Icone nome="busca" />
          </div>
          <div className="campo">
            <label htmlFor="c-unidade">Unidade</label>
            <select id="c-unidade" value={estado.unidade} onChange={(e) => mudar({ unidade: e.target.value })}>
              <option value="">Todas</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="c-ofertas">Ofertas</label>
            <select id="c-ofertas" value={estado.ofertas} onChange={(e) => mudar({ ofertas: e.target.value })}>
              <option value="">Todos</option>
              <option value="sim">Aceitam receber</option>
              <option value="nao">Não aceitam</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="c-aniversario">Aniversário</label>
            <select id="c-aniversario" value={estado.aniversario} onChange={(e) => mudar({ aniversario: e.target.value })}>
              <option value="">Todos</option>
              <option value="mes">Em {nomeDoMes(MES_ATUAL)}</option>
              <option value="proximo">Em {nomeDoMes(MES_QUE_VEM)}</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="c-origem">Origem</label>
            <select id="c-origem" value={estado.origem} onChange={(e) => mudar({ origem: e.target.value })}>
              <option value="">Todas</option>
              <option value="survey">{ORIGEM_ROTULO.survey}</option>
              <option value="import">{ORIGEM_ROTULO.import}</option>
              <option value="manual">{ORIGEM_ROTULO.manual}</option>
            </select>
          </div>
        </form>
        <div className="filtros__rodape">
          <p className="filtros__contagem" id="c-contagem" role="status" aria-live="polite">
            {lista.data ? (
              <>
                <strong>{total.toLocaleString('pt-BR')}</strong> {total === 1 ? 'cliente' : 'clientes'}
              </>
            ) : null}
          </p>
          {temFiltro && (
            <button className="btn btn--fantasma" type="button" onClick={limpar}>
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      <section className="cartao" aria-label="Lista de clientes" aria-busy={lista.isFetching || undefined}>
        {lista.isLoading && <p className="cl-mudo">Carregando…</p>}
        {lista.isError && (
          <p className="vazio">
            <strong>Não foi possível carregar os clientes</strong>
            {lista.error instanceof ApiError ? `Erro ${lista.error.status}. ` : ''}Tente recarregar a página.
          </p>
        )}
        {lista.data && itens.length === 0 && (
          <p className="vazio">
            <strong>{temFiltro ? 'Nenhum cliente com esses filtros' : 'Nenhum cliente ainda'}</strong>
            {temFiltro ? 'Tente outra busca ou clique em “Limpar filtros”.' : 'Eles aparecem quando alguém deixa o contato na pesquisa.'}
          </p>
        )}
        {itens.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela cl-tabela">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Unidade</th>
                  <th scope="col">Respostas</th>
                  <th scope="col">Última interação</th>
                  <th scope="col">Aniversário</th>
                  <th scope="col">Origem</th>
                  <th scope="col">Ofertas</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((c) => {
                  const aniv = aniversario(c.birthDate);
                  const respostas = c.totalResponses ?? 0;
                  return (
                    <tr key={c.id}>
                      <td data-col="cliente">
                        <button
                          className="oc-abrir"
                          type="button"
                          data-cl-abrir={c.id}
                          aria-haspopup="dialog"
                          onClick={() => mudar({ abrir: c.id }, true)}
                        >
                          <span className="oc-abrir__texto">
                            {c.name || 'Sem nome'}
                            {c.doNotContact && <span className="cl-selo cl-selo--alerta">não contatar</span>}
                          </span>
                          <span className="oc-abrir__meta">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</span>
                        </button>
                      </td>
                      <td data-col="unidade">{c.originUnit?.name ?? '—'}</td>
                      <td data-col="respostas">
                        <span className="cl-respostas">
                          {typeof c.lastNpsScore === 'number' && <NotaSelo nota={c.lastNpsScore} rotulo="Última nota " />}
                          {respostas} {respostas === 1 ? 'resposta' : 'respostas'}
                        </span>
                      </td>
                      <td data-col="ultima">
                        {c.lastInteractionAt ? quando(c.lastInteractionAt) : <span className="cl-mudo">Nenhuma ainda</span>}
                      </td>
                      <td data-col="aniversario">
                        {aniv ? (
                          <>
                            <Icone nome="premios" />
                            <span className="visualmente-oculto">Aniversário </span>
                            {aniv}
                            {mesNascimento(c.birthDate) === MES_ATUAL && <span className="cl-selo">este mês</span>}
                          </>
                        ) : (
                          <span className="cl-mudo">Sem data</span>
                        )}
                      </td>
                      <td data-col="origem">{c.source ? ORIGEM_ROTULO[c.source] : <span className="cl-mudo">—</span>}</td>
                      <td data-col="ofertas">
                        {c.acceptsOffers === true ? (
                          <span className="cl-ofertas cl-ofertas--sim">Aceita ofertas</span>
                        ) : c.acceptsOffers === false ? (
                          <span className="cl-ofertas">Não aceita ofertas</span>
                        ) : (
                          <span className="cl-ofertas">Não informado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {lista.data && paginas > 1 && (
          <nav className="cl-paginacao" aria-label="Páginas">
            <button
              className="btn btn--secundario"
              type="button"
              disabled={pagina <= 1}
              onClick={() => mudar({ pagina: pagina - 1 > 1 ? String(pagina - 1) : '' })}
            >
              Anterior
            </button>
            <span>
              Página <strong>{pagina}</strong> de {paginas}
            </span>
            <button
              className="btn btn--secundario"
              type="button"
              disabled={pagina >= paginas}
              onClick={() => mudar({ pagina: String(pagina + 1) })}
            >
              Próxima
            </button>
          </nav>
        )}
      </section>

      <Gaveta aberta={Boolean(abrir)} onFechar={() => mudar({ abrir: '' }, true)} rotuloId="cg-titulo" larga focoInicial="cg-titulo">
        {abrir && (
          <ClienteGavetaConteudo
            id={abrir}
            unidades={unidades}
            podeEditar={podeEditar}
            podeVerRespostas={podeVerRespostas}
            onFechar={() => mudar({ abrir: '' }, true)}
            onSalvo={(c) => {
              mudar({ abrir: '' }, true);
              avisar(`Dados de ${c.name || 'cliente'} salvos`);
            }}
          />
        )}
      </Gaveta>

      <Gaveta aberta={gaveta === 'novo'} onFechar={() => setGaveta(null)} rotuloId="cn-titulo" larga focoInicial="cn-nome">
        <NovoClienteConteudo
          unidades={unidades}
          todasUnidades={todas}
          onFechar={() => setGaveta(null)}
          onCriado={(c) => {
            setGaveta(null);
            avisar(`${c.name || 'Cliente'} cadastrado`);
          }}
          onAbrirExistente={(id) => {
            setGaveta(null);
            mudar({ abrir: id }, true);
          }}
        />
      </Gaveta>

      <Gaveta aberta={gaveta === 'importar'} onFechar={() => setGaveta(null)} rotuloId="ci-titulo" focoInicial="ci-titulo">
        <ImportarConteudo
          onFechar={() => setGaveta(null)}
          onImportado={(r) => avisar(`Importação concluída: ${r.created ?? r.imported} novo(s)${typeof r.updated === 'number' ? `, ${r.updated} atualizado(s)` : ''}`)}
        />
      </Gaveta>

      <Gaveta aberta={gaveta === 'exportar'} onFechar={() => setGaveta(null)} rotuloId="ce-titulo" focoInicial="ce-titulo">
        <ExportarConteudo
          filtrosLista={filtrosApi}
          totais={{ lista: lista.data?.total, ofertas: kOfertas.data, todos: kTotal.data }}
          onFechar={() => setGaveta(null)}
          onExportado={(qtd) => {
            setGaveta(null);
            avisar(`${qtd} ${qtd === 1 ? 'cliente exportado' : 'clientes exportados'}`);
          }}
        />
      </Gaveta>

      {aviso}
    </>
  );
}
