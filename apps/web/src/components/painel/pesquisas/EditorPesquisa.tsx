import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import {
  extraQuestionKindFromType,
  persistedTypeFromExtraKind,
  type ExtraQuestionKind,
} from '../../../lib/question-types';
import { FormularioCliente, type PerguntaFormulario } from '../../survey/FormularioCliente';
import { Icone } from '../Icone';
import { Confirmar, type ConfirmarOpcoes } from './Confirmar';
import { ChavesIdentificacao } from './Identificacao';
import {
  dataHora,
  identidadeDaPesquisa,
  payloadIdentidade,
  type Identidade,
  mensagemErro,
  NPS_TITULO_PADRAO,
  TIPOS_PERGUNTA,
  type SurveyDetail,
  type SurveyQuestionDetail,
  type Unit,
} from './tipos';

type Opcao = { id: string; label: string; value: string; negative: boolean };

type Pergunta = {
  uid: string;
  title: string;
  kind: ExtraQuestionKind;
  storedType?: string;
  required: boolean;
  onlyLowScore: boolean;
  configOriginal?: SurveyQuestionDetail['config'];
  options: Opcao[];
  erroTitulo?: boolean;
  erroOpcoes?: boolean;
  entrou?: boolean;
};

export type ResultadoEditor = { id?: string; msg: 'publicada' | 'rascunho' | 'apagada' };

type Props = {
  editId: string | null;
  unidades: Unit[];
  unidadesCarregando: boolean;
  badScoreThreshold: number;
  empresa: string;
  avisar: (t: string) => void;
  onConcluir: (r: ResultadoEditor) => void;
  onSair: () => void;
};

const SUGESTOES = ['O que poderíamos melhorar?', 'O que você mais gostou?', 'Como foi o atendimento?'];

const novaOpcao = (label = ''): Opcao => ({ id: crypto.randomUUID(), label, value: crypto.randomUUID(), negative: false });

function novaPergunta(title = ''): Pergunta {
  return {
    uid: crypto.randomUUID(),
    title,
    kind: 'open',
    storedType: 'text_long',
    required: false,
    onlyLowScore: false,
    options: [novaOpcao(), novaOpcao()],
    entrou: true,
  };
}

function perguntaDoRascunho(q: SurveyQuestionDetail): Pergunta {
  const kind = extraQuestionKindFromType(q.type);
  const options =
    q.options
      ?.slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((o) => ({ id: o.id ?? crypto.randomUUID(), label: o.label, value: o.value, negative: Boolean(o.negative) })) ?? [];
  return {
    uid: q.id,
    title: q.title,
    kind,
    storedType: q.type,
    required: q.required,
    onlyLowScore: Boolean(q.config?.when?.npsMax),
    configOriginal: q.config ?? null,
    options: options.length >= 2 ? options : [...options, ...Array.from({ length: 2 - options.length }, () => novaOpcao())],
  };
}

/** config.when.npsMax = nota baixa do tenant (como hoje); preserva um npsMin que já existisse. */
function configDa(q: Pergunta, limite: number) {
  const npsMin = q.configOriginal?.when?.npsMin;
  if (q.onlyLowScore) return { when: { ...(typeof npsMin === 'number' ? { npsMin } : {}), npsMax: limite } };
  if (typeof npsMin === 'number') return { when: { npsMin } };
  return undefined;
}

const contar = (n: number) => `${n} ${n === 1 ? 'pergunta' : 'perguntas'}`;

/** Editor de pesquisa (pesquisa-nova.html): 3 etapas + prévia ao vivo no celular + barra de ações. */
export function EditorPesquisa({
  editId,
  unidades,
  unidadesCarregando,
  badScoreThreshold,
  empresa,
  avisar,
  onConcluir,
  onSair,
}: Props) {
  const detalhe = useQuery({
    queryKey: ['surveyDetail', editId],
    queryFn: () => apiFetch<SurveyDetail>(`/surveys/${encodeURIComponent(editId!)}`),
    enabled: Boolean(editId),
  });

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [unidadeIds, setUnidadeIds] = useState<string[]>([]);
  const [ident, setIdent] = useState<Identidade>({ collectEmployee: true, collectCustomer: true, requireCustomerIdentity: false });
  const [perguntas, setPerguntas] = useState<Pergunta[]>(() => (editId ? [] : [novaPergunta('O que poderíamos melhorar?')]));
  const [npsTitulo, setNpsTitulo] = useState(NPS_TITULO_PADRAO);
  const [carregado, setCarregado] = useState(!editId);
  const [alterado, setAlterado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [status, setStatus] = useState('');
  const [erroNome, setErroNome] = useState(false);
  const [erroUnidades, setErroUnidades] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{ tipo: 'publicar' | 'apagar' | 'sair'; opcoes: ConfirmarOpcoes } | null>(
    null,
  );
  const [unidadePrevia, setUnidadePrevia] = useState('');
  const [sinalCadastro, setSinalCadastro] = useState(0);
  const [buscaPrevia, setBuscaPrevia] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // Carrega o rascunho
  useEffect(() => {
    if (!editId || carregado || !detalhe.data) return;
    const s = detalhe.data;
    setNome(s.name);
    setDescricao(s.description ?? '');
    setUnidadeIds(s.units.map((u) => u.unitId));
    setIdent(identidadeDaPesquisa(s));
    const qs = s.draftVersion?.questions.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) ?? [];
    const nps = qs.find((q) => q.type === 'nps');
    if (nps?.title.trim()) setNpsTitulo(nps.title);
    setPerguntas(qs.filter((q) => q.type !== 'nps').map(perguntaDoRascunho));
    setCarregado(true);
  }, [editId, carregado, detalhe.data]);

  // Com uma unidade só no cadastro, já vem marcada
  useEffect(() => {
    if (!editId && unidades.length === 1 && unidadeIds.length === 0 && !alterado) setUnidadeIds([unidades[0].id]);
  }, [editId, unidades, unidadeIds.length, alterado]);

  // Aviso do navegador ao sair com alterações
  useEffect(() => {
    if (!alterado) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [alterado]);

  function tocar() {
    setAlterado(true);
    setVersao((v) => v + 1);
    setStatus('Alterações não salvas');
  }

  function focarDepois(seletor: string) {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(seletor)?.focus());
  }

  function mudarPergunta(uid: string, mud: (q: Pergunta) => Pergunta) {
    setPerguntas((prev) => prev.map((q) => (q.uid === uid ? mud(q) : q)));
    tocar();
  }

  function adicionarPergunta(title = '') {
    const q = novaPergunta(title);
    setPerguntas((prev) => [...prev, q]);
    tocar();
    focarDepois(`#titulo-${CSS.escape(q.uid)}`);
  }

  function moverPergunta(i: number, passo: number) {
    const total = perguntas.length;
    const destino = i + passo;
    if (destino < 0 || destino >= total) return;
    const q = perguntas[i];
    setPerguntas((prev) => {
      const nova = prev.slice();
      nova.splice(i, 1);
      nova.splice(destino, 0, q);
      return nova;
    });
    tocar();
    const fim = destino === 0 || destino === total - 1;
    focarDepois(`[data-uid="${CSS.escape(q.uid)}"] [data-mover="${fim ? -passo : passo}"]`);
    avisar(`Pergunta movida para a posição ${destino + 2}`);
  }

  // ----- Prévia -----
  const unidadesEscolhidas = useMemo(
    () => unidades.filter((u) => unidadeIds.includes(u.id)),
    [unidades, unidadeIds],
  );
  const previaUnidade = unidadesEscolhidas.find((u) => u.id === unidadePrevia) ?? unidadesEscolhidas[0] ?? null;

  const atendentesPrevia = useQuery({
    queryKey: ['employees', 'previa', previaUnidade?.id],
    queryFn: () =>
      apiFetch<unknown>(`/employees?unitId=${encodeURIComponent(previaUnidade!.id)}&status=active`).then((r) => {
        const lista = Array.isArray(r) ? r : Array.isArray((r as { items?: unknown })?.items) ? (r as { items: unknown[] }).items : [];
        return (lista as Array<{ id: string; name: string; roleTitle?: string | null; code?: string | null }>).map((e) => ({
          id: e.id,
          name: e.name,
          roleTitle: e.roleTitle ?? null,
          code: e.code ?? null,
        }));
      }),
    enabled: Boolean(previaUnidade) && ident.collectEmployee,
    retry: false,
  });
  const atendentesFiltrados = useMemo(() => {
    const t = buscaPrevia.trim().toLowerCase();
    const lista = atendentesPrevia.data ?? [];
    return (t ? lista.filter((e) => e.name.toLowerCase().includes(t)) : lista).slice(0, 20);
  }, [atendentesPrevia.data, buscaPrevia]);

  const perguntasPrevia = useMemo<PerguntaFormulario[]>(
    () => [
      { id: 'nps', title: npsTitulo, type: 'nps', required: true, order: 0, options: [] },
      ...perguntas.map((q, i) => ({
        id: q.uid,
        title: q.title,
        type: persistedTypeFromExtraKind(q.kind, q.storedType),
        required: q.required,
        order: i + 1,
        config: configDa(q, badScoreThreshold),
        options:
          q.kind === 'single_choice'
            ? q.options.filter((o) => o.label.trim()).map((o) => ({ value: o.value, label: o.label, negative: o.negative }))
            : [],
      })),
    ],
    [npsTitulo, perguntas, badScoreThreshold],
  );

  // ----- Salvar / publicar / apagar -----
  const corpo = () => ({
    name: nome.trim(),
    description: descricao.trim(),
    ...payloadIdentidade(ident),
    unitIds: unidadeIds,
    questions: [
      { title: npsTitulo, type: 'nps', required: true },
      ...perguntas.map((q) => ({
        title: q.title.trim(),
        type: persistedTypeFromExtraKind(q.kind, q.storedType),
        required: q.required,
        config: configDa(q, badScoreThreshold),
        options:
          q.kind === 'single_choice'
            ? q.options
                .filter((o) => o.label.trim())
                .map((o) => ({ label: o.label.trim(), value: o.value, negative: o.negative }))
            : undefined,
      })),
    ],
  });

  const salvar = useMutation({
    mutationFn: async (publicar: boolean) => {
      let id = editId;
      if (id) {
        await apiFetch(`/surveys/${encodeURIComponent(id)}`, { method: 'PATCH', json: corpo() });
      } else {
        const criada = await apiFetch<{ id: string }>('/surveys', { method: 'POST', json: corpo() });
        id = criada.id;
      }
      if (publicar) await apiFetch(`/surveys/${encodeURIComponent(id)}/publish`, { method: 'POST' });
      return { id, publicar };
    },
    onSuccess: ({ id, publicar }) => {
      setAlterado(false);
      setConfirmacao(null);
      onConcluir({ id, msg: publicar ? 'publicada' : 'rascunho' });
    },
    onError: (err) => {
      setConfirmacao(null);
      setStatus(mensagemErro(err, 'Não deu para salvar. Confira os campos e tente de novo.'));
    },
  });

  const apagar = useMutation({
    mutationFn: () => apiFetch(`/surveys/${encodeURIComponent(editId!)}/delete`, { method: 'POST' }),
    onSuccess: () => {
      setAlterado(false);
      setConfirmacao(null);
      onConcluir({ msg: 'apagada' });
    },
  });

  function validar(completo: boolean) {
    let primeiro: string | null = null;
    let n = 0;
    const falhou = (sel: string) => {
      n += 1;
      if (!primeiro) primeiro = sel;
    };
    const semNome = !nome.trim();
    setErroNome(semNome);
    if (semNome) falhou('#pq-nome');
    const semUnidade = unidadeIds.length === 0;
    setErroUnidades(semUnidade);
    if (semUnidade) falhou('[data-unidades] input');
    if (completo) {
      const novas = perguntas.map((q) => ({
        ...q,
        erroTitulo: !q.title.trim(),
        erroOpcoes: q.kind === 'single_choice' && q.options.filter((o) => o.label.trim()).length < 2,
      }));
      setPerguntas(novas);
      for (const q of novas) {
        if (q.erroTitulo) falhou(`#titulo-${CSS.escape(q.uid)}`);
        if (q.erroOpcoes) falhou(`[data-uid="${CSS.escape(q.uid)}"] [data-opcao]`);
      }
    }
    if (primeiro) {
      setStatus(`Corrija ${n === 1 ? 'o item destacado' : `os ${n} itens destacados`} para continuar.`);
      const sel: string = primeiro;
      requestAnimationFrame(() => {
        const el = formRef.current?.querySelector<HTMLElement>(sel);
        el?.focus();
        el?.scrollIntoView({ block: 'center' });
      });
      return false;
    }
    return true;
  }

  function pedirPublicar() {
    if (!validar(true)) return;
    const nomesUnidades = unidadesEscolhidas.map((u) => u.name).join(', ');
    setConfirmacao({
      tipo: 'publicar',
      opcoes: {
        titulo: 'Tem certeza de que já pode publicar?',
        texto: (
          <p>
            Depois de publicada, <strong>a pesquisa não pode mais ser editada</strong> (só a identificação, em “Links”). Revise
            antes, inclusive na prévia “Como o cliente vê”:
            <span className="revisar">
              <span className="revisar__item">
                <span>Nome</span>
                <strong>{nome.trim()}</strong>
              </span>
              <span className="revisar__item">
                <span>{unidadesEscolhidas.length > 1 ? 'Unidades' : 'Unidade'}</span>
                <strong>
                  {nomesUnidades}
                  {unidadesEscolhidas.length > 1 ? ` (${unidadesEscolhidas.length} links, um por unidade)` : ''}
                </strong>
              </span>
              <span className="revisar__item">
                <span>Perguntas</span>
                <strong>{contar(perguntas.length + 1)}, com nota de 1 a 10</strong>
              </span>
              <span className="revisar__item">
                <span>Atendente</span>
                <strong>{ident.collectEmployee ? 'Pergunta “Quem te atendeu?”' : 'Não pergunta'}</strong>
              </span>
              <span className="revisar__item">
                <span>Contato do cliente</span>
                <strong>
                  {ident.collectCustomer ? (ident.requireCustomerIdentity ? 'Pede, obrigatório' : 'Pede, opcional') : 'Não pede'}
                </strong>
              </span>
            </span>
          </p>
        ),
        botao: 'Publicar',
        icone: 'alerta',
        botaoVoltar: 'Voltar e revisar',
        exigir: 'Revisei a pesquisa e a prévia. Está tudo certo.',
      },
    });
  }

  function confirmar() {
    if (!confirmacao) return;
    if (confirmacao.tipo === 'publicar') salvar.mutate(true);
    if (confirmacao.tipo === 'apagar') apagar.mutate();
    if (confirmacao.tipo === 'sair') {
      setAlterado(false);
      setConfirmacao(null);
      onSair();
    }
  }

  function cancelarConfirmacao() {
    const tipo = confirmacao?.tipo;
    setConfirmacao(null);
    apagar.reset();
    if (tipo === 'publicar') {
      setStatus('Revise as 3 etapas e a prévia ao lado. Quando estiver tudo certo, clique em Publicar.');
      requestAnimationFrame(() => {
        const topo = document.getElementById('pq-p1');
        topo?.focus();
        topo?.scrollIntoView({ block: 'start' });
      });
    }
  }

  function sair() {
    if (!alterado) return onSair();
    setConfirmacao({
      tipo: 'sair',
      opcoes: {
        titulo: 'Sair sem salvar?',
        texto: <p>As alterações desta pesquisa serão perdidas. Para guardar e continuar depois, use “Salvar rascunho”.</p>,
        botao: 'Sair sem salvar',
        perigo: true,
      },
    });
  }

  // ----- Estados de carregamento / bloqueio -----
  if (editId && detalhe.isLoading) {
    return <p className="vazio">Carregando a pesquisa…</p>;
  }
  if (editId && (detalhe.isError || !detalhe.data)) {
    return (
      <section className="cartao breve">
        <span className="breve__icone" aria-hidden="true">
          <Icone nome="alerta" />
        </span>
        <h1 className="cabeca__titulo">Pesquisa não encontrada</h1>
        <div className="breve__acoes">
          <button className="btn btn--secundario" type="button" onClick={onSair}>
            Voltar para Pesquisas
          </button>
        </div>
      </section>
    );
  }
  if (editId && detalhe.data && detalhe.data.status !== 'draft') {
    const s = detalhe.data;
    const publicada = s.status === 'published';
    return (
      <section className="cartao breve">
        <span className="breve__icone" aria-hidden="true">
          <Icone nome="cadeado" />
        </span>
        <h1 className="cabeca__titulo">
          Esta pesquisa {publicada ? 'já foi publicada' : 'está arquivada'} e não pode ser editada
        </h1>
        <p>
          <strong>{s.name}</strong>
          {s.publishedAt ? `, publicada em ${dataHora(s.publishedAt)}` : ''}
          {s.archivedAt ? ` e arquivada em ${dataHora(s.archivedAt)}` : ''}. Só rascunhos podem ser editados: assim todas as
          respostas de uma pesquisa são às mesmas perguntas. A identificação (atendente e contato) pode ser mudada em “Links”.
        </p>
        <div className="breve__acoes">
          <button className="btn btn--secundario" type="button" onClick={onSair}>
            Voltar para Pesquisas
          </button>
        </div>
      </section>
    );
  }

  const ehRascunho = Boolean(editId);
  const ocupado = salvar.isPending || apagar.isPending || !carregado;
  const todas = unidades.length > 0 && unidadeIds.length === unidades.length;

  return (
    <>
      <div className="cabeca">
        <div>
          <p className="trilha">
            <a
              href={typeof window !== 'undefined' ? window.location.pathname : '#'}
              onClick={(e) => {
                e.preventDefault();
                sair();
              }}
            >
              Pesquisas
            </a>
            <span aria-hidden="true">›</span>
            <span>{ehRascunho ? 'Rascunho' : 'Nova'}</span>
          </p>
          <h1 className="cabeca__titulo">{ehRascunho ? 'Editar rascunho' : 'Nova pesquisa'}</h1>
          <p className="cabeca__desc">
            {ehRascunho && detalhe.data?.createdAt
              ? `Rascunho criado em ${dataHora(detalhe.data.createdAt)}. Pode ser editado até ser publicado.`
              : 'Monte as perguntas e acompanhe na prévia como o cliente vai responder.'}
          </p>
        </div>
      </div>

      <div className="editor">
        <form ref={formRef} className="editor__form" noValidate onSubmit={(e) => e.preventDefault()}>
          {/* 1 · Sobre a pesquisa */}
          <section className="cartao passo" aria-labelledby="pq-p1">
            <div className="passo__topo">
              <span className="passo__num" aria-hidden="true">
                1
              </span>
              <div>
                <h2 className="passo__titulo" id="pq-p1" tabIndex={-1}>
                  Sobre a pesquisa
                </h2>
                <p className="passo__sub">O nome e a descrição aparecem para o cliente.</p>
              </div>
            </div>
            <div className="campo">
              <label htmlFor="pq-nome">
                Nome da pesquisa{' '}
                <span className="obrigatorio" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="pq-nome"
                type="text"
                placeholder="Ex.: Pesquisa de satisfação"
                required
                autoComplete="off"
                value={nome}
                aria-invalid={erroNome || undefined}
                aria-describedby={erroNome ? 'pq-nome-erro' : undefined}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (e.target.value.trim()) setErroNome(false);
                  tocar();
                }}
              />
              {erroNome && (
                <p className="campo__erro" id="pq-nome-erro">
                  Dê um nome para a pesquisa.
                </p>
              )}
            </div>
            <div className="campo">
              <label htmlFor="pq-descricao">
                Descrição <span className="opcional">(opcional)</span>
              </label>
              <input
                id="pq-descricao"
                type="text"
                placeholder="Ex.: Conte como foi sua experiência."
                autoComplete="off"
                value={descricao}
                onChange={(e) => {
                  setDescricao(e.target.value);
                  tocar();
                }}
              />
            </div>
            <fieldset
              className="unidades-campo"
              aria-describedby={`pq-unidades-dica${erroUnidades ? ' pq-unidades-erro' : ''}`}
              data-unidades=""
            >
              <legend className="campo__rotulo">
                Unidades{' '}
                <span className="obrigatorio" aria-hidden="true">
                  *
                </span>
              </legend>
              {unidadesCarregando && <p className="campo__dica">Carregando unidades…</p>}
              <div className="unidades-opcoes">
                {unidades.map((u) => (
                  <label key={u.id} className="unidade-opcao">
                    <input
                      type="checkbox"
                      checked={unidadeIds.includes(u.id)}
                      onChange={(e) => {
                        setUnidadeIds((prev) => {
                          const marcadas = e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id);
                          return unidades.map((x) => x.id).filter((id) => marcadas.includes(id));
                        });
                        if (e.target.checked) setErroUnidades(false);
                        tocar();
                      }}
                    />
                    <span>
                      <Icone nome="loja" />
                      {u.name}
                    </span>
                  </label>
                ))}
              </div>
              {unidades.length > 1 && (
                <button
                  className="btn btn--fantasma unidades-todas"
                  type="button"
                  onClick={() => {
                    setUnidadeIds(todas ? [] : unidades.map((u) => u.id));
                    if (!todas) setErroUnidades(false);
                    tocar();
                  }}
                >
                  {todas ? 'Desmarcar todas' : 'Marcar todas'}
                </button>
              )}
              <p className="campo__dica" id="pq-unidades-dica">
                Marque uma ou mais. Cada unidade ganha o próprio link e QR Code, e as respostas ficam separadas por unidade.
              </p>
              {erroUnidades && (
                <p className="campo__erro" id="pq-unidades-erro">
                  Marque pelo menos uma unidade.
                </p>
              )}
              {unidadesEscolhidas.length > 0 && (
                <div className="unidades-links">
                  <p className="unidades-links__titulo">
                    {unidadesEscolhidas.length === 1 ? 'Link' : `${unidadesEscolhidas.length} links`} ao publicar:
                  </p>
                  <ul>
                    {unidadesEscolhidas.map((u) => (
                      <li key={u.id}>
                        <span>{u.name}</span>
                        <code>link e QR Code próprios</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </fieldset>
          </section>

          {/* 2 · Perguntas */}
          <section className="cartao passo" aria-labelledby="pq-p2">
            <div className="passo__topo">
              <span className="passo__num" aria-hidden="true">
                2
              </span>
              <div>
                <h2 className="passo__titulo" id="pq-p2">
                  Perguntas
                </h2>
                <p className="passo__sub">{contar(perguntas.length + 1)}. A primeira é a nota de recomendação (NPS).</p>
              </div>
            </div>

            <div className="pergunta pergunta--fixa">
              <div className="pergunta__topo">
                <span className="pergunta__num" aria-hidden="true">
                  1
                </span>
                <h3 className="pergunta__rotulo">Nota de recomendação</h3>
                <span className="pergunta__selo">Base do NPS</span>
              </div>
              <div className="pergunta__corpo">
                <p className="pergunta__texto-fixo">{npsTitulo}</p>
                <p className="campo__dica">
                  Obrigatória e sempre a primeira. Escala de 1 a 10: 9 e 10 = promotores · 7 e 8 = passivos · 1 a 6 =
                  detratores. É dela que saem o NPS, o Ranking e as ocorrências automáticas.
                </p>
              </div>
            </div>

            <div className="perguntas">
              {perguntas.map((q, i) => {
                const n = i + 2;
                const tipoGuardado = q.storedType;
                const mantido =
                  (q.kind === 'open' && tipoGuardado === 'text_short') ||
                  (q.kind === 'single_choice' && tipoGuardado === 'multiple_choice');
                return (
                  <div key={q.uid} className="pergunta" data-uid={q.uid} data-entrou={q.entrou ? '' : undefined}>
                    <div className="pergunta__topo">
                      <span className="pergunta__num" aria-hidden="true">
                        {n}
                      </span>
                      <h3 className="pergunta__rotulo">Pergunta {n}</h3>
                      <div className="pergunta__ferramentas">
                        <button
                          className="botao-icone"
                          type="button"
                          data-mover="-1"
                          aria-label={`Subir pergunta ${n}`}
                          disabled={i === 0}
                          onClick={() => moverPergunta(i, -1)}
                        >
                          <Icone nome="cima" />
                        </button>
                        <button
                          className="botao-icone"
                          type="button"
                          data-mover="1"
                          aria-label={`Descer pergunta ${n}`}
                          disabled={i === perguntas.length - 1}
                          onClick={() => moverPergunta(i, 1)}
                        >
                          <Icone nome="baixo" />
                        </button>
                        <button
                          className="botao-icone"
                          type="button"
                          data-remover=""
                          aria-label={`Remover pergunta ${n}`}
                          onClick={() => {
                            setPerguntas((prev) => prev.filter((x) => x.uid !== q.uid));
                            tocar();
                            avisar('Pergunta removida');
                            focarDepois('[data-adicionar]');
                          }}
                        >
                          <Icone nome="lixeira" />
                        </button>
                      </div>
                    </div>
                    <div className="campo">
                      <label htmlFor={`titulo-${q.uid}`}>
                        Pergunta{' '}
                        <span className="obrigatorio" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <input
                        id={`titulo-${q.uid}`}
                        type="text"
                        placeholder="Ex.: O que poderíamos melhorar?"
                        required
                        value={q.title}
                        aria-invalid={q.erroTitulo || undefined}
                        aria-describedby={q.erroTitulo ? `titulo-${q.uid}-erro` : undefined}
                        onChange={(e) =>
                          mudarPergunta(q.uid, (x) => ({
                            ...x,
                            title: e.target.value,
                            erroTitulo: x.erroTitulo && !e.target.value.trim(),
                            entrou: false,
                          }))
                        }
                      />
                      {q.erroTitulo && (
                        <p className="campo__erro" id={`titulo-${q.uid}-erro`}>
                          Escreva a pergunta.
                        </p>
                      )}
                    </div>
                    <fieldset className="tipos">
                      <legend>Tipo de resposta</legend>
                      {TIPOS_PERGUNTA.map((t) => (
                        <label key={t.kind} className="tipo">
                          <input
                            type="radio"
                            name={`tipo-${q.uid}`}
                            value={t.kind}
                            checked={q.kind === t.kind}
                            onChange={() =>
                              mudarPergunta(q.uid, (x) => ({
                                ...x,
                                kind: t.kind,
                                erroOpcoes: false,
                                entrou: false,
                                options: x.options.length >= 2 ? x.options : [novaOpcao(), novaOpcao()],
                              }))
                            }
                          />
                          <Icone nome={t.icone} />
                          {t.nome}
                        </label>
                      ))}
                    </fieldset>
                    {mantido && (
                      <p className="campo__dica pq-tipo-mantido">
                        Esta pergunta usa o tipo{' '}
                        <strong>{tipoGuardado === 'text_short' ? 'Texto curto (uma linha)' : 'Múltipla escolha'}</strong>, que
                        continua igual ao salvar.
                      </p>
                    )}
                    {q.kind === 'single_choice' && (
                      <div className="campo">
                        <span className="campo__rotulo" id={`op-rotulo-${q.uid}`}>
                          Opções de resposta
                        </span>
                        <div className="opcoes" role="group" aria-labelledby={`op-rotulo-${q.uid}`}>
                          {q.options.map((o, j) => (
                            <div key={o.id} className="opcao pq-opcao">
                              <span className="opcao__marca" aria-hidden="true" />
                              <input
                                type="text"
                                value={o.label}
                                placeholder={`Opção ${j + 1}`}
                                aria-label={`Opção ${j + 1}`}
                                data-opcao=""
                                aria-invalid={q.erroOpcoes || undefined}
                                aria-describedby={q.erroOpcoes ? `op-erro-${q.uid}` : undefined}
                                onChange={(e) =>
                                  mudarPergunta(q.uid, (x) => ({
                                    ...x,
                                    options: x.options.map((y) => (y.id === o.id ? { ...y, label: e.target.value } : y)),
                                  }))
                                }
                              />
                              <label
                                className="pq-opcao__negativa"
                                title="Resposta negativa: pede “Por quê?” ao cliente"
                              >
                                <input
                                  type="checkbox"
                                  checked={o.negative}
                                  onChange={(e) =>
                                    mudarPergunta(q.uid, (x) => ({
                                      ...x,
                                      options: x.options.map((y) =>
                                        y.id === o.id ? { ...y, negative: e.target.checked } : y,
                                      ),
                                    }))
                                  }
                                />
                                Negativa<span className="visualmente-oculto"> (opção {j + 1})</span>
                              </label>
                              <button
                                className="botao-icone"
                                type="button"
                                aria-label={`Remover opção ${j + 1}`}
                                disabled={q.options.length <= 2}
                                onClick={() => {
                                  mudarPergunta(q.uid, (x) => ({ ...x, options: x.options.filter((y) => y.id !== o.id) }));
                                  focarDepois(`[data-uid="${CSS.escape(q.uid)}"] [data-adicionar-opcao]`);
                                }}
                              >
                                <Icone nome="fechar" />
                              </button>
                            </div>
                          ))}
                        </div>
                        {q.erroOpcoes && (
                          <p className="campo__erro" id={`op-erro-${q.uid}`}>
                            Preencha pelo menos 2 opções.
                          </p>
                        )}
                        <p className="campo__dica">
                          Marque “Negativa” nas respostas ruins: o cliente que escolher uma delas responde “Por quê?”.
                        </p>
                        <button
                          className="btn btn--fantasma pq-opcao__adicionar"
                          type="button"
                          data-adicionar-opcao=""
                          onClick={() => {
                            mudarPergunta(q.uid, (x) => ({ ...x, options: [...x.options, novaOpcao()] }));
                            requestAnimationFrame(() => {
                              const campos = formRef.current?.querySelectorAll<HTMLElement>(
                                `[data-uid="${CSS.escape(q.uid)}"] [data-opcao]`,
                              );
                              campos?.[campos.length - 1]?.focus();
                            });
                          }}
                        >
                          <Icone nome="mais" />
                          Adicionar opção
                        </button>
                      </div>
                    )}
                    <div className="chaves chaves--linha">
                      <label className="chave">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => mudarPergunta(q.uid, (x) => ({ ...x, required: e.target.checked }))}
                        />
                        <span className="chave__texto">Resposta obrigatória</span>
                      </label>
                      <label className="chave">
                        <input
                          type="checkbox"
                          checked={q.onlyLowScore}
                          onChange={(e) => mudarPergunta(q.uid, (x) => ({ ...x, onlyLowScore: e.target.checked }))}
                        />
                        <span className="chave__texto">Só para quem der nota 1 a {badScoreThreshold}</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="adicionar" type="button" data-adicionar="" onClick={() => adicionarPergunta()}>
              <Icone nome="mais" />
              Adicionar pergunta
            </button>
            <div className="sugestoes">
              <span className="sugestoes__rotulo">Sugestões:</span>
              {SUGESTOES.map((s) => (
                <button key={s} className="sugestao" type="button" onClick={() => adicionarPergunta(s)}>
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* 3 · Identificação */}
          <section className="cartao passo" aria-labelledby="pq-p3">
            <div className="passo__topo">
              <span className="passo__num" aria-hidden="true">
                3
              </span>
              <div>
                <h2 className="passo__titulo" id="pq-p3">
                  Atendente e contato do cliente
                </h2>
                <p className="passo__sub">Dá para mudar depois de publicar, em “Links”.</p>
              </div>
            </div>
            <ChavesIdentificacao
              valor={ident}
              onChange={(v) => {
                setIdent(v);
                tocar();
              }}
            />
          </section>
        </form>

        {/* Prévia ao vivo e interativa: nada é enviado nem salvo */}
        <aside className="previa" aria-labelledby="pq-previa-titulo">
          <p className="previa__titulo" id="pq-previa-titulo">
            <Icone nome="celular" />
            Como o cliente vê <span>Teste: clique, digite e envie</span>
          </p>
          {unidadesEscolhidas.length > 1 && (
            <div className="campo previa__unidade">
              <label htmlFor="pq-previa-unidade">Ver como na unidade</label>
              <select
                id="pq-previa-unidade"
                value={previaUnidade?.id ?? ''}
                onChange={(e) => setUnidadePrevia(e.target.value)}
              >
                {unidadesEscolhidas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="previa__acoes">
            <button
              className="btn btn--secundario"
              type="button"
              disabled={!ident.collectCustomer}
              aria-describedby={!ident.collectCustomer ? 'pq-ver-cadastro-dica' : undefined}
              onClick={() => setSinalCadastro((n) => n + 1)}
            >
              <Icone nome="pessoa" />
              Ver pop-up de cadastro
            </button>
            {!ident.collectCustomer && (
              <p className="previa__dica" id="pq-ver-cadastro-dica">
                Ligue “Pedir nome e contato do cliente” (passo 3) para o cadastro aparecer.
              </p>
            )}
          </div>
          <FormularioCliente
            previa
            empresa={empresa}
            unidade={previaUnidade?.name ?? null}
            nome={nome}
            descricao={descricao}
            perguntas={perguntasPrevia}
            coletarAtendente={ident.collectEmployee}
            coletarCliente={ident.collectCustomer}
            clienteObrigatorio={ident.collectCustomer && ident.requireCustomerIdentity}
            badScoreThreshold={badScoreThreshold}
            atendentes={atendentesFiltrados}
            atendentesCarregando={atendentesPrevia.isLoading && atendentesPrevia.fetchStatus !== 'idle'}
            onBuscarAtendente={setBuscaPrevia}
            onEnviar={async () => undefined}
            abrirCadastroSinal={sinalCadastro}
            versao={versao}
          >
            {({ conteudo, pop, popAberto }) => (
              <div className="celular">
                <div className="celular__tela" inert={popAberto || undefined}>
                  {conteudo}
                </div>
                {pop}
              </div>
            )}
          </FormularioCliente>
          <p className="previa__nota">Só um teste: nada é enviado nem salvo.</p>
        </aside>
      </div>

      <div className="barra-acoes">
        <p className="barra-acoes__status" role="status" aria-live="polite">
          {status}
        </p>
        {ehRascunho && (
          <button
            className="btn btn--perigo"
            type="button"
            disabled={ocupado}
            onClick={() =>
              setConfirmacao({
                tipo: 'apagar',
                opcoes: {
                  titulo: 'Apagar este rascunho?',
                  texto: (
                    <p>
                      <strong>{detalhe.data?.name ?? nome}</strong> some da listagem. Não dá para desfazer por aqui.
                    </p>
                  ),
                  botao: 'Apagar',
                  perigo: true,
                  icone: 'lixeira',
                },
              })
            }
          >
            <Icone nome="lixeira" />
            Apagar rascunho
          </button>
        )}
        <button className="btn btn--fantasma" type="button" onClick={sair} disabled={salvar.isPending}>
          Cancelar
        </button>
        <button
          className="btn btn--secundario"
          type="button"
          disabled={ocupado}
          onClick={() => {
            if (validar(false)) salvar.mutate(false);
          }}
        >
          {salvar.isPending && !salvar.variables ? 'Salvando…' : 'Salvar rascunho'}
        </button>
        <button className="btn btn--primario" type="button" disabled={ocupado} onClick={pedirPublicar}>
          {salvar.isPending && salvar.variables ? 'Publicando…' : 'Publicar'}
        </button>
      </div>

      <Confirmar
        opcoes={confirmacao?.opcoes ?? null}
        ocupado={salvar.isPending || apagar.isPending}
        erro={apagar.isError ? mensagemErro(apagar.error, 'Não deu para apagar. Tente de novo.') : null}
        onConfirmar={confirmar}
        onCancelar={cancelarConfirmacao}
      />
    </>
  );
}
