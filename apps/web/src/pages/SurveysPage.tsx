import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import type { UnarchiveSurveyResponse } from '../lib/api-novos';
import { Icone } from '../components/painel/Icone';
import { usePode, useAuthMe } from '../components/painel/usePainel';
import { Confirmar, type ConfirmarOpcoes } from '../components/painel/pesquisas/Confirmar';
import { EditorPesquisa, type ResultadoEditor } from '../components/painel/pesquisas/EditorPesquisa';
import { LinksPesquisa } from '../components/painel/pesquisas/LinksPesquisa';
import { useAviso } from '../components/painel/pesquisas/useAviso';
import {
  dataHora,
  mensagemErro,
  NOMES_STATUS,
  quandoRelativo,
  type SurveyListItem,
  type Unit,
} from '../components/painel/pesquisas/tipos';
import '../styles/painel-pesquisas.css';

type Filtro = 'todas' | 'publicada' | 'rascunho' | 'arquivada';
const FILTROS: Array<{ valor: Filtro; nome: string; status?: string }> = [
  { valor: 'todas', nome: 'Todas' },
  { valor: 'publicada', nome: 'Publicadas', status: 'published' },
  { valor: 'rascunho', nome: 'Rascunhos', status: 'draft' },
  { valor: 'arquivada', nome: 'Arquivadas', status: 'archived' },
];
const ORDEM: Record<string, number> = { draft: 0, published: 1, archived: 2 };

const ultimoMomento = (s: SurveyListItem) =>
  Math.max(
    ...[s.updatedAt, s.publishedAt, s.archivedAt, s.createdAt]
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime())
      .filter((n) => Number.isFinite(n)),
    0,
  );

function Quando({ rotulo, iso }: { rotulo: string; iso?: string | null }) {
  if (!iso) return null;
  return (
    <time dateTime={iso} title={quandoRelativo(iso) || undefined}>
      {rotulo} em {dataHora(iso)}
    </time>
  );
}

type Acao = { tipo: 'arquivar' | 'apagar'; pesquisa: SurveyListItem };

export function SurveysPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const editarId = params.get('editar');
  const criando = params.get('nova') === '1';
  const filtroUrl = params.get('status') as Filtro | null;
  const filtro: Filtro = FILTROS.some((f) => f.valor === filtroUrl) ? (filtroUrl as Filtro) : 'todas';

  const me = useAuthMe();
  const pode = usePode();
  const podeGerenciar = !me.data || pode('survey:manage');
  const { avisar, elemento: toast } = useAviso();

  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });
  const tenant = useQuery({
    queryKey: ['tenantMe'],
    queryFn: () => apiFetch<{ tradeName?: string | null; settings?: { badScoreThreshold?: number } }>('/tenant/me'),
  });
  const surveys = useQuery({
    queryKey: ['surveys', { includeArchived: true }],
    queryFn: () => apiFetch<SurveyListItem[]>('/surveys?includeArchived=true'),
  });

  const badScoreThreshold = useMemo(() => {
    const v = tenant.data?.settings?.badScoreThreshold;
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 6;
  }, [tenant.data]);

  const [destaque, setDestaque] = useState<string | null>(null);
  const [links, setLinks] = useState<{ id: string; unidade?: string | null } | null>(null);
  const [acao, setAcao] = useState<Acao | null>(null);
  const novaRef = useRef<HTMLButtonElement>(null);

  const todas = useMemo(() => surveys.data ?? [], [surveys.data]);
  const totais = useMemo(() => {
    const t: Record<Filtro, number> = { todas: todas.length, publicada: 0, rascunho: 0, arquivada: 0 };
    for (const f of FILTROS) if (f.status) t[f.valor] = todas.filter((s) => s.status === f.status).length;
    return t;
  }, [todas]);
  const itens = useMemo(() => {
    const status = FILTROS.find((f) => f.valor === filtro)?.status;
    return todas
      .filter((s) => !status || s.status === status)
      .sort((a, b) => (ORDEM[a.status] ?? 9) - (ORDEM[b.status] ?? 9) || ultimoMomento(b) - ultimoMomento(a));
  }, [todas, filtro]);

  function irPara(next: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p);
  }

  const invalidar = async () => {
    await qc.invalidateQueries({ queryKey: ['surveys'] });
    await qc.invalidateQueries({ queryKey: ['surveyDistributions'] });
  };

  const arquivar = useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/surveys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: async (_, id) => {
      setAcao(null);
      setLinks((l) => (l?.id === id ? null : l));
      avisar('Pesquisa arquivada');
      await invalidar();
      novaRef.current?.focus();
    },
  });
  const apagar = useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/surveys/${encodeURIComponent(id)}/delete`, { method: 'POST' }),
    onSuccess: async (_, id) => {
      const era = acao?.pesquisa.status;
      setAcao(null);
      setLinks((l) => (l?.id === id ? null : l));
      avisar(era === 'draft' ? 'Rascunho apagado' : 'Pesquisa apagada');
      await invalidar();
      novaRef.current?.focus();
    },
  });
  const desarquivar = useMutation({
    mutationFn: (id: string) =>
      apiFetch<UnarchiveSurveyResponse>(`/surveys/${encodeURIComponent(id)}/unarchive`, { method: 'POST' }),
    onSuccess: async (r) => {
      avisar(r?.status === 'draft' ? 'Pesquisa desarquivada: voltou para os rascunhos' : 'Pesquisa desarquivada: o link volta a funcionar');
      await invalidar();
      novaRef.current?.focus();
    },
    onError: (err) => avisar(mensagemErro(err, 'Não deu para desarquivar. Tente de novo.')),
  });

  function concluirEditor(r: ResultadoEditor) {
    const mensagens = {
      publicada: 'Pesquisa publicada. Copie o link para começar a receber respostas.',
      rascunho: 'Rascunho salvo',
      apagada: 'Rascunho apagado',
    } as const;
    avisar(mensagens[r.msg]);
    setDestaque(r.id ?? null);
    if (r.msg === 'publicada' && r.id) setLinks({ id: r.id });
    irPara({ editar: null, nova: null });
    void invalidar();
  }

  // Ao trocar de tela (lista ↔ editor), volta ao topo
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [editarId, criando]);

  useEffect(() => {
    if (!destaque) return;
    const t = window.setTimeout(() => setDestaque(null), 2600);
    return () => window.clearTimeout(t);
  }, [destaque]);

  const empresa = tenant.data?.tradeName?.trim() || '';

  if (editarId || criando) {
    return (
      <>
        <EditorPesquisa
          key={editarId ?? 'nova'}
          editId={editarId}
          unidades={units.data ?? []}
          unidadesCarregando={units.isLoading}
          badScoreThreshold={badScoreThreshold}
          empresa={empresa}
          avisar={avisar}
          onConcluir={concluirEditor}
          onSair={() => irPara({ editar: null, nova: null })}
        />
        {toast}
      </>
    );
  }

  const pesquisaLinks = links ? todas.find((s) => s.id === links.id) ?? null : null;
  const totalUnidades = units.data?.length ?? 0;

  function confirmarOpcoes(a: Acao): ConfirmarOpcoes {
    const p = a.pesquisa;
    const nomes = p.units.map((u) => u.unit.name).join(', ');
    const respostas = p.responsesCount ?? 0;
    if (a.tipo === 'arquivar') {
      return {
        titulo: 'Arquivar esta pesquisa?',
        texto: (
          <p>
            <strong>{p.name}</strong>
            {nomes ? ` (${nomes})` : ''} para de receber respostas e os links deixam de funcionar.
            {respostas ? ` As ${respostas.toLocaleString('pt-BR')} respostas continuam guardadas.` : ''} Dá para desarquivar
            depois.
          </p>
        ),
        botao: 'Arquivar',
        icone: 'arquivar',
      };
    }
    return {
      titulo: p.status === 'draft' ? 'Apagar este rascunho?' : 'Apagar esta pesquisa?',
      texto: (
        <p>
          <strong>{p.name}</strong>
          {nomes ? ` (${nomes})` : ''} some da listagem
          {p.status === 'published' ? ' e os links param de funcionar na hora' : ''}. Não dá para desfazer por aqui.
          {p.status === 'published' ? ' Para só tirar do ar, use “Arquivar”.' : ''}
        </p>
      ),
      botao: 'Apagar',
      perigo: true,
      icone: 'lixeira',
    };
  }

  return (
    <>
      <div className="cabeca">
        <div>
          <h1 className="cabeca__titulo">Pesquisas</h1>
          <p className="cabeca__desc">Crie a pesquisa, publique e compartilhe o link com os clientes.</p>
        </div>
        {podeGerenciar && (
          <button ref={novaRef} className="btn btn--primario" type="button" onClick={() => irPara({ nova: '1' })}>
            <Icone nome="mais" />
            Nova pesquisa
          </button>
        )}
      </div>

      <div className="alternar" role="group" aria-label="Mostrar pesquisas">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            aria-pressed={filtro === f.valor}
            onClick={() => irPara({ status: f.valor === 'todas' ? null : f.valor })}
          >
            {f.nome} <span className="alternar__total">{surveys.data ? totais[f.valor] : '…'}</span>
          </button>
        ))}
      </div>

      {surveys.isLoading && <p className="vazio">Carregando pesquisas…</p>}
      {surveys.isError && (
        <div className="cartao vazio">
          <strong>Falha ao carregar pesquisas</strong>
          <button className="btn btn--secundario" type="button" onClick={() => surveys.refetch()}>
            Tentar de novo
          </button>
        </div>
      )}

      {surveys.data && itens.length > 0 && (
        <ul className="pq-lista">
          {itens.map((s) => {
            const st = NOMES_STATUS[s.status] ?? { rotulo: s.status, classe: '' };
            const unidades = s.units;
            const varias = unidades.length > 1;
            const nomesUnidades =
              varias && totalUnidades > 1 && unidades.length === totalUnidades
                ? 'Todas as unidades'
                : unidades.map((u) => u.unit.name).join(', ');
            const respostas = s.responsesCount ?? 0;
            const ocupado = arquivar.isPending || apagar.isPending || desarquivar.isPending;
            return (
              <li key={s.id}>
                <article
                  className="cartao pq-cartao"
                  data-novo={destaque === s.id ? '' : undefined}
                  aria-labelledby={`pq-${s.id}`}
                >
                  <div className="pq-cartao__topo">
                    <span className={`status ${st.classe}`}>{st.rotulo}</span>
                    <span className="pq-cartao__id" title={s.id}>
                      #{s.id.slice(0, 8)}
                    </span>
                  </div>
                  <div>
                    <h2 className="pq-cartao__nome" id={`pq-${s.id}`}>
                      {s.name}
                    </h2>
                    <p className="pq-cartao__meta">
                      <span>
                        <Icone nome="loja" />
                        {nomesUnidades || 'Sem unidade'}
                      </span>
                      {s.status === 'draft' ? (
                        <span>
                          <Icone nome="relogio" />
                          <Quando rotulo="Salvo" iso={s.updatedAt ?? s.createdAt} />
                        </span>
                      ) : (
                        s.publishedAt && (
                          <span>
                            <Icone nome="relogio" />
                            <Quando rotulo="Publicada" iso={s.publishedAt} />
                          </span>
                        )
                      )}
                      {s.status === 'archived' && s.archivedAt && (
                        <span>
                          <Icone nome="arquivar" />
                          <Quando rotulo="Arquivada" iso={s.archivedAt} />
                        </span>
                      )}
                      {s.status !== 'draft' && (
                        <span>
                          <Icone nome="cadeado" />
                          Perguntas não podem ser editadas
                        </span>
                      )}
                    </p>
                  </div>

                  {s.status === 'draft' && !respostas ? (
                    <div className="pq-cartao__numero">
                      <span>
                        Ainda não publicada: sem link para os clientes.
                        {varias ? ` Ao publicar, cada unidade ganha o próprio link (${unidades.length} links).` : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="pq-cartao__numero">
                      <strong>{respostas.toLocaleString('pt-BR')}</strong>
                      <span>
                        {respostas === 1 ? 'resposta' : 'respostas'}
                        {varias ? ` nas ${unidades.length} unidades` : ''}
                      </span>
                    </div>
                  )}

                  {s.status === 'published' && unidades.length > 0 && (
                    <div className="pq-unidades" aria-label="Link e QR Code por unidade">
                      {unidades.map((u) => (
                        <button
                          key={u.unitId}
                          className="pq-unidade"
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => setLinks({ id: s.id, unidade: u.unitId })}
                        >
                          <Icone nome="qr" />
                          {u.unit.name}
                          <span className="visualmente-oculto">: link e QR Code</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pq-cartao__acoes">
                    {s.status === 'published' && (
                      <>
                        <button
                          className="btn btn--primario"
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => setLinks({ id: s.id })}
                        >
                          <Icone nome="link" />
                          Links{varias ? ` (${unidades.length})` : ''}
                        </button>
                        {podeGerenciar && (
                          <button
                            className="btn btn--secundario"
                            type="button"
                            disabled={ocupado}
                            onClick={() => setAcao({ tipo: 'arquivar', pesquisa: s })}
                          >
                            <Icone nome="arquivar" />
                            Arquivar
                          </button>
                        )}
                      </>
                    )}
                    {s.status === 'draft' && (
                      <>
                        {podeGerenciar && (
                          <button
                            className="btn btn--primario"
                            type="button"
                            onClick={() => irPara({ editar: s.id })}
                          >
                            <Icone nome="editar" />
                            Continuar editando
                          </button>
                        )}
                        <button
                          className="btn btn--secundario"
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => setLinks({ id: s.id })}
                        >
                          <Icone nome="link" />
                          Links
                        </button>
                        {podeGerenciar && (
                          <button
                            className="btn btn--secundario"
                            type="button"
                            disabled={ocupado}
                            onClick={() => setAcao({ tipo: 'arquivar', pesquisa: s })}
                          >
                            <Icone nome="arquivar" />
                            Arquivar
                          </button>
                        )}
                      </>
                    )}
                    {s.status === 'archived' && (
                      <>
                        {podeGerenciar && (
                          <button
                            className="btn btn--secundario"
                            type="button"
                            disabled={ocupado}
                            onClick={() => desarquivar.mutate(s.id)}
                          >
                            {desarquivar.isPending && desarquivar.variables === s.id ? 'Desarquivando…' : 'Desarquivar'}
                          </button>
                        )}
                        <button
                          className="btn btn--secundario"
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => setLinks({ id: s.id })}
                        >
                          <Icone nome="link" />
                          Links
                        </button>
                      </>
                    )}
                    {podeGerenciar && (
                      <button
                        className="btn btn--perigo btn--icone"
                        type="button"
                        disabled={ocupado}
                        aria-label={`Apagar ${s.name}${nomesUnidades ? ` (${nomesUnidades})` : ''}`}
                        title="Apagar"
                        onClick={() => setAcao({ tipo: 'apagar', pesquisa: s })}
                      >
                        <Icone nome="lixeira" />
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {surveys.data && itens.length === 0 && (
        <div className="cartao vazio">
          <strong>Nenhuma pesquisa aqui</strong>
          {podeGerenciar ? 'Crie uma em “Nova pesquisa” ou escolha outro filtro.' : 'Escolha outro filtro.'}
        </div>
      )}

      {pesquisaLinks && (
        <LinksPesquisa
          key={`${pesquisaLinks.id}-${links?.unidade ?? ''}`}
          pesquisa={pesquisaLinks}
          unidadeInicial={links?.unidade ?? null}
          unidades={units.data ?? []}
          podeGerenciar={podeGerenciar}
          avisar={avisar}
          onFechar={() => setLinks(null)}
        />
      )}

      <Confirmar
        opcoes={acao ? confirmarOpcoes(acao) : null}
        ocupado={arquivar.isPending || apagar.isPending}
        erro={
          arquivar.isError
            ? mensagemErro(arquivar.error, 'Não deu para arquivar. Tente de novo.')
            : apagar.isError
              ? mensagemErro(apagar.error, 'Não deu para apagar. Tente de novo.')
              : null
        }
        onConfirmar={() => {
          if (!acao) return;
          if (acao.tipo === 'arquivar') arquivar.mutate(acao.pesquisa.id);
          else apagar.mutate(acao.pesquisa.id);
        }}
        onCancelar={() => {
          setAcao(null);
          arquivar.reset();
          apagar.reset();
        }}
      />
      {toast}
    </>
  );
}
