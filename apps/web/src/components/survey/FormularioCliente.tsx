import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icone } from '../painel/Icone';
import {
  isAnswerMissing,
  isPrimaryRatingType,
  isScaleExtraQuestionType,
  isScaleScore,
  isSingleChoiceQuestionType,
  isStarsQuestionType,
  isStarsScore,
  isThumbsQuestionType,
  isThumbsValue,
  packAnswerValue,
  shouldShowWhyFollowUp,
} from '../../lib/question-types';
import { PerguntaCliente, type PerguntaClienteDados } from './PerguntaCliente';

export type PerguntaFormulario = PerguntaClienteDados & {
  order: number;
  config?: unknown;
};

export type AtendenteCliente = { id: string; name: string; code?: string | null; roleTitle?: string | null };

export type EnvioCliente = {
  employeeId?: string;
  complaint?: string;
  answers: Array<{ questionId: string; value: unknown }>;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    document?: string;
    birthDate?: string;
    acceptsOffers?: boolean;
  };
};

type QuestionConfig = {
  when?: { npsMin?: number; npsMax?: number };
  requiredWhenVisible?: boolean;
};

type Contato = { nome: string; telefone: string; email: string; cpf: string; nascimento: string; aceite: boolean };
type CampoContato = keyof Omit<Contato, 'aceite'> | 'geral';

type Props = {
  /** true = prévia do editor (nada é enviado; mostra "Responder de novo" e os selos de condição) */
  previa?: boolean;
  empresa: string;
  unidade?: string | null;
  nome: string;
  descricao?: string | null;
  introMessage?: string | null;
  outroMessage?: string | null;
  perguntas: PerguntaFormulario[];
  coletarAtendente: boolean;
  coletarCliente: boolean;
  clienteObrigatorio: boolean;
  googleUrl?: string | null;
  badScoreThreshold: number;
  atendentes?: AtendenteCliente[];
  atendentesCarregando?: boolean;
  atendentesErro?: boolean;
  onBuscarAtendente?: (q: string) => void;
  onEnviar: (envio: EnvioCliente) => Promise<unknown>;
  /** incrementar abre o pop-up de cadastro (atalho da prévia) */
  abrirCadastroSinal?: number;
  /** incrementar volta da tela "Obrigado" para as perguntas (prévia: a pesquisa mudou) */
  versao?: number;
  children: (partes: { conteudo: ReactNode; pop: ReactNode; popAberto: boolean }) => ReactNode;
};

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const contatoVazio = (): Contato => ({ nome: '', telefone: '', email: '', cpf: '', nascimento: '', aceite: false });

function obrigatoria(q: PerguntaFormulario) {
  const cfg = q.config as QuestionConfig | null | undefined;
  return Boolean(q.required || cfg?.requiredWhenVisible);
}

function faltando(q: PerguntaFormulario, v: unknown) {
  if (isScaleExtraQuestionType(q.type) || isPrimaryRatingType(q.type)) return !isScaleScore(v);
  if (isStarsQuestionType(q.type)) return !isStarsScore(v);
  if (isThumbsQuestionType(q.type)) return !isThumbsValue(v);
  return isAnswerMissing(v);
}

function textoCondicao(cfg: QuestionConfig | null | undefined) {
  const w = cfg?.when;
  if (!w) return null;
  if (typeof w.npsMax === 'number' && typeof w.npsMin === 'number') return `Só aparece para notas de ${w.npsMin} a ${w.npsMax}`;
  if (typeof w.npsMax === 'number') return `Só aparece para notas de 1 a ${w.npsMax}`;
  if (typeof w.npsMin === 'number') return `Só aparece para notas de ${w.npsMin} a 10`;
  return null;
}

/**
 * Formulário que o cliente responde, no visual do protótipo (responder.html / prévia do editor).
 * Fluxo: cadastro em pop-up (se a pesquisa pede contato) → atendente → nota (NPS 1–10) → perguntas → Enviar → Obrigado.
 */
export function FormularioCliente(props: Props) {
  const {
    previa = false,
    empresa,
    unidade,
    nome,
    descricao,
    introMessage,
    outroMessage,
    perguntas,
    coletarAtendente,
    coletarCliente,
    clienteObrigatorio,
    googleUrl,
    badScoreThreshold,
    atendentes,
    atendentesCarregando,
    atendentesErro,
    onBuscarAtendente,
    onEnviar,
    abrirCadastroSinal,
    versao,
    children,
  } = props;

  const H = previa ? 'h3' : 'h1';
  const H2 = previa ? 'h4' : 'h2';
  const idBase = previa ? 'pv' : 'pub';

  const ordenadas = useMemo(() => perguntas.slice().sort((a, b) => a.order - b.order), [perguntas]);
  const nps = useMemo(() => ordenadas.find((q) => isPrimaryRatingType(q.type)) ?? null, [ordenadas]);

  const [tela, setTela] = useState<'contato' | 'pesquisa' | 'fim'>(coletarCliente ? 'contato' : 'pesquisa');
  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [porques, setPorques] = useState<Record<string, string>>({});
  const [falta, setFalta] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [contato, setContato] = useState<Contato>(contatoVazio);
  const [erros, setErros] = useState<Partial<Record<CampoContato, string>>>({});
  const [cadastrou, setCadastrou] = useState(false);

  const [atendente, setAtendente] = useState<AtendenteCliente | null>(null);
  const [busca, setBusca] = useState('');
  const [listaAberta, setListaAberta] = useState(false);

  const conteudoRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // A pesquisa pública abre com o foco no cadastro; a prévia não rouba o foco do editor
  const foco = useRef<'pop' | 'inicio' | 'fim' | 'falta' | null>(!previa && coletarCliente ? 'pop' : null);

  const nota = nps ? respostas[nps.id] : undefined;
  const notaEscolhida = isScaleScore(nota) ? nota : null;

  // Prévia: sem nota, mostra as condicionais (com o selo); na pesquisa real, só depois da nota.
  const visiveis = useMemo(() => {
    const efetiva = notaEscolhida ?? (previa ? null : 10);
    return ordenadas.filter((q) => {
      if (nps && q.id === nps.id) return false;
      const when = (q.config as QuestionConfig | null | undefined)?.when;
      if (!when || efetiva === null) return true;
      if (typeof when.npsMin === 'number' && efetiva < when.npsMin) return false;
      if (typeof when.npsMax === 'number' && efetiva > when.npsMax) return false;
      return true;
    });
  }, [ordenadas, nps, notaEscolhida, previa]);

  // Pesquisa mudou na prévia ou o cadastro deixou de ser pedido
  useEffect(() => {
    if (!coletarCliente) setTela((t) => (t === 'contato' ? 'pesquisa' : t));
  }, [coletarCliente]);
  useEffect(() => {
    if (versao === undefined) return;
    setTela((t) => (t === 'fim' ? 'pesquisa' : t));
  }, [versao]);
  useEffect(() => {
    if (!abrirCadastroSinal) return;
    setFalta(false);
    setErros({});
    setAviso('');
    foco.current = 'pop';
    setTela('contato');
  }, [abrirCadastroSinal]);

  // Pesquisa pública: o pop-up trava a rolagem da página
  useEffect(() => {
    if (previa) return;
    document.body.style.overflow = tela === 'contato' ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [tela, previa]);

  // Foco depois de trocar de tela
  useEffect(() => {
    const alvo = foco.current;
    if (!alvo) return;
    foco.current = null;
    requestAnimationFrame(() => {
      if (alvo === 'pop') popRef.current?.querySelector<HTMLElement>('[data-pop-titulo]')?.focus();
      if (alvo === 'fim') conteudoRef.current?.querySelector<HTMLElement>('[data-fim]')?.focus();
      if (alvo === 'inicio') {
        if (!previa) window.scrollTo(0, 0);
        conteudoRef.current?.querySelector<HTMLElement>('button, textarea, select, input')?.focus();
      }
      if (alvo === 'falta') {
        const primeira = conteudoRef.current?.querySelector<HTMLElement>('.cli__q--falta');
        primeira?.scrollIntoView({ block: 'center' });
        primeira?.querySelector<HTMLElement>('button, textarea, select, input')?.focus();
      }
    });
  });

  useEffect(() => {
    if (!listaAberta) return;
    const fora = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && !t.closest('[data-atendente-caixa]')) setListaAberta(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [listaAberta]);

  function setResposta(id: string, v: unknown) {
    setRespostas((p) => ({ ...p, [id]: v }));
    setErroEnvio(null);
  }

  function irParaPerguntas(msg = '') {
    setErros({});
    setAviso(msg);
    foco.current = 'inicio';
    setTela('pesquisa');
  }

  function cadastrar() {
    const c = contato;
    const e: Partial<Record<CampoContato, string>> = {};
    const algum = Boolean(c.nome.trim() || c.telefone.trim() || c.email.trim() || c.cpf.trim());
    if (!algum) e.geral = clienteObrigatorio
      ? 'Informe nome, e-mail ou telefone para se identificar.'
      : 'Preencha seus dados ou toque em “Responder sem cadastro”.';
    if (c.email.trim() && !/^\S+@\S+\.\S+$/.test(c.email.trim())) e.email = 'Confira o e-mail (nome@exemplo.com).';
    if (c.telefone.trim() && c.telefone.replace(/\D/g, '').length < 10) e.telefone = 'Informe o telefone com DDD.';
    if (c.cpf.trim() && c.cpf.replace(/\D/g, '').length !== 11) e.cpf = 'O CPF tem 11 números.';
    if (c.nascimento && c.nascimento > hojeIso()) e.nascimento = 'A data de nascimento não pode ser no futuro.';
    setErros(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() =>
        popRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-campo-primeiro]')?.focus(),
      );
      return;
    }
    setCadastrou(true);
    const primeiro = c.nome.trim().split(/\s+/)[0];
    irParaPerguntas(
      primeiro ? `Cadastro feito, ${primeiro}! Agora é só responder.${previa ? ' (teste)' : ''}` : 'Cadastro feito! Agora é só responder.',
    );
  }

  async function enviar() {
    if (enviando) return;
    setErroEnvio(null);
    if (clienteObrigatorio && coletarCliente && !cadastrou) {
      foco.current = 'pop';
      setTela('contato');
      return;
    }
    const faltaNota = Boolean(nps) && !isScaleScore(nota);
    const faltaExtra = visiveis.some((q) => obrigatoria(q) && faltando(q, respostas[q.id]));
    if (faltaNota || faltaExtra) {
      setFalta(true);
      foco.current = 'falta';
      return;
    }
    setFalta(false);

    const answers: EnvioCliente['answers'] = [];
    const lista = nps ? [nps, ...visiveis] : visiveis;
    for (const q of lista) {
      const v = respostas[q.id];
      if (faltando(q, v)) continue;
      const label = isSingleChoiceQuestionType(q.type) ? q.options.find((o) => o.value === v)?.label : undefined;
      const incluirPorque = shouldShowWhyFollowUp({ type: q.type, value: v, options: q.options });
      answers.push({
        questionId: q.id,
        value: packAnswerValue(typeof v === 'string' ? v.trim() : v, {
          why: incluirPorque ? porques[q.id] : undefined,
          label,
        }),
      });
    }
    const porqueNps =
      nps && shouldShowWhyFollowUp({ type: nps.type, value: nota }) ? porques[nps.id]?.trim() : undefined;

    const c = contato;
    const customer: EnvioCliente['customer'] =
      coletarCliente && cadastrou
        ? {
            name: c.nome.trim() || undefined,
            email: c.email.trim() || undefined,
            phone: c.telefone.trim() || undefined,
            document: c.cpf.trim() || undefined,
            birthDate: c.nascimento || undefined,
            // Aceite de ofertas: só vai quando marcado (caixa separada, desmarcada por padrão)
            acceptsOffers: c.aceite ? true : undefined,
          }
        : undefined;

    setEnviando(true);
    try {
      await onEnviar({
        employeeId: atendente?.id,
        complaint: porqueNps || undefined,
        answers,
        customer,
      });
      foco.current = 'fim';
      setTela('fim');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setErroEnvio(
        msg === 'customer_identity_required'
          ? 'Informe nome, e-mail ou telefone para se identificar.'
          : msg && msg !== 'ApiError'
            ? msg
            : 'Falha ao enviar. Tente novamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  function refazer() {
    setRespostas({});
    setPorques({});
    setFalta(false);
    setAviso('');
    setErroEnvio(null);
    setContato(contatoVazio());
    setErros({});
    setCadastrou(false);
    setAtendente(null);
    setBusca('');
    foco.current = coletarCliente ? 'pop' : 'inicio';
    setTela(coletarCliente ? 'contato' : 'pesquisa');
  }

  const marca = (
    <div className="cli__marca">
      <img src="/icon-opiina.png" alt="" width={22} height={22} />
      {empresa}
      {unidade ? ` · ${unidade}` : ''}
    </div>
  );

  // ----- Tela final -----
  if (tela === 'fim') {
    const primeiro = cadastrou ? contato.nome.trim().split(/\s+/)[0] : '';
    const mostrarGoogle = Boolean(googleUrl && googleUrl.trim()) && notaEscolhida !== null && notaEscolhida > badScoreThreshold;
    const conteudo = (
      <div className="cli" ref={conteudoRef}>
        {marca}
        <div className="cli__fim">
          <span className="cli__fim-icone" aria-hidden="true">
            <Icone nome="ok" />
          </span>
          <H className="cli__titulo" tabIndex={-1} data-fim="">
            Obrigado{primeiro ? `, ${primeiro}` : ''}!
          </H>
          <p className="cli__desc">
            Sua avaliação foi enviada{cadastrou ? ' e seu cadastro também' : ''}.
          </p>
          <p className="cli__desc">{outroMessage?.trim() || 'Você pode fechar esta página.'}</p>
        </div>
        {mostrarGoogle && (
          <div className="pq-google">
            <p className="pq-google__titulo">Nos ajude com um comentário no Google</p>
            <p className="cli__desc">
              Se você teve uma boa experiência, deixe um comentário no Google Meu Negócio da unidade.
            </p>
            <a className="cli__enviar" href={googleUrl!} target="_blank" rel="noreferrer">
              Avaliar no Google
            </a>
          </div>
        )}
        {previa && (
          <button type="button" className="cli-pop__depois" onClick={refazer}>
            Responder de novo
          </button>
        )}
      </div>
    );
    return <>{children({ conteudo, pop: null, popAberto: false })}</>;
  }

  // ----- Pesquisa -----
  const faltaNota = falta && Boolean(nps) && !isScaleScore(nota);
  const popAberto = tela === 'contato' && coletarCliente;

  const campoAtendente = coletarAtendente && (
    <div className="cli__q" data-atendente-caixa="">
      <label className="cli__q-titulo" htmlFor={`${idBase}-atendente`}>
        Quem te atendeu? <span className="cli-pop__opcional">(opcional)</span>
      </label>
      <div className="pq-atendente">
        <input
          id={`${idBase}-atendente`}
          className="cli__campo"
          value={busca}
          autoComplete="off"
          placeholder="Digite o nome do atendente"
          aria-controls={`${idBase}-atendente-lista`}
          aria-expanded={listaAberta}
          onFocus={() => setListaAberta(true)}
          onChange={(e) => {
            setBusca(e.target.value);
            setAtendente(null);
            setListaAberta(true);
            onBuscarAtendente?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setListaAberta(false);
          }}
        />
        {listaAberta && (
          <div className="pq-atendente__lista" id={`${idBase}-atendente-lista`}>
            {atendentesCarregando && <p className="pq-atendente__estado">Carregando…</p>}
            {atendentesErro && <p className="pq-atendente__estado">Falha ao carregar atendentes</p>}
            {!atendentesCarregando && !atendentesErro && !atendentes?.length && (
              <p className="pq-atendente__estado">Nenhum atendente encontrado</p>
            )}
            {atendentes?.map((a) => (
              <button
                key={a.id}
                type="button"
                className="pq-atendente__item"
                aria-pressed={atendente?.id === a.id}
                onClick={() => {
                  setAtendente(a);
                  setBusca(a.name);
                  setListaAberta(false);
                }}
              >
                <strong>{a.name}</strong>
                {(a.roleTitle || a.code) && <span>{[a.roleTitle, a.code].filter(Boolean).join(' • ')}</span>}
              </button>
            ))}
            <button
              type="button"
              className="pq-atendente__item pq-atendente__item--limpar"
              onClick={() => {
                setAtendente(null);
                setBusca('');
                setListaAberta(false);
                onBuscarAtendente?.('');
              }}
            >
              Não lembro / limpar
            </button>
          </div>
        )}
      </div>
      {atendente && (
        <p className="cli-pop__opcional">
          Selecionado: <strong>{atendente.name}</strong>
        </p>
      )}
    </div>
  );

  const conteudo = (
    <div className="cli" ref={conteudoRef} inert={popAberto || undefined}>
      {marca}
      <div>
        <H className="cli__titulo">{nome.trim() ? nome : <span className="cli__vazio">Nome da pesquisa</span>}</H>
        {descricao?.trim() && <p className="cli__desc">{descricao}</p>}
        {introMessage?.trim() && <p className="cli__desc">{introMessage}</p>}
      </div>

      {campoAtendente}

      {nps && (
        <PerguntaCliente
          idBase={`${idBase}-nps`}
          pergunta={{ ...nps, required: true }}
          valor={nota}
          porque={porques[nps.id] ?? ''}
          onValor={(v) => setResposta(nps.id, v)}
          onPorque={(t) => setPorques((p) => ({ ...p, [nps.id]: t }))}
          falta={faltaNota}
          semPorque={previa}
        />
      )}

      {visiveis.map((q) => (
        <PerguntaCliente
          key={q.id}
          idBase={`${idBase}-q-${q.id}`}
          pergunta={{ ...q, required: obrigatoria(q) }}
          valor={respostas[q.id]}
          porque={porques[q.id] ?? ''}
          onValor={(v) => setResposta(q.id, v)}
          onPorque={(t) => setPorques((p) => ({ ...p, [q.id]: t }))}
          falta={falta && obrigatoria(q) && faltando(q, respostas[q.id])}
          condicao={previa ? textoCondicao(q.config as QuestionConfig | null | undefined) : null}
          tituloVazio="Sua pergunta aparece aqui"
          semPorque={previa}
        />
      ))}

      {falta && (
        <p className="cli__erro cli__erro--geral" role="alert">
          Responda as perguntas marcadas com *.
        </p>
      )}
      {erroEnvio && (
        <p className="cli__erro cli__erro--geral" role="alert">
          {erroEnvio}
        </p>
      )}
      {aviso && (
        <p className="cli__aviso" role="status">
          <Icone nome="ok" />
          {aviso}
        </p>
      )}
      <button type="button" className="cli__enviar" onClick={enviar} disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar'}
      </button>
      {coletarCliente && !cadastrou && (
        <button
          type="button"
          className="cli-pop__depois"
          onClick={() => {
            foco.current = 'pop';
            setTela('contato');
          }}
        >
          Quero me cadastrar
        </button>
      )}
      {coletarCliente && cadastrou && (
        <button
          type="button"
          className="cli-pop__depois"
          onClick={() => {
            foco.current = 'pop';
            setTela('contato');
          }}
        >
          Revisar meu cadastro
        </button>
      )}
    </div>
  );

  // ----- Pop-up de cadastro -----
  const erro = (campo: CampoContato) =>
    erros[campo] ? (
      <p className="cli__erro" id={`${idBase}-c-${campo}-erro`}>
        {erros[campo]}
      </p>
    ) : null;
  const invalido = (campo: CampoContato) =>
    erros[campo] ? { 'aria-invalid': true, 'aria-describedby': `${idBase}-c-${campo}-erro` } : {};
  const mudar = (campo: keyof Contato, v: string | boolean) => {
    setContato((p) => ({ ...p, [campo]: v }));
    if (erros[campo as CampoContato] || erros.geral) setErros((p) => ({ ...p, [campo]: undefined, geral: undefined }));
  };
  const opcional = !clienteObrigatorio;
  const totalPerguntas = visiveis.length + (nps ? 1 : 0);

  const pop = popAberto ? (
    <div
      ref={popRef}
      className={previa ? 'cli-pop' : 'cli-pop pub__pop'}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && opcional) {
          e.stopPropagation();
          irParaPerguntas();
        }
      }}
    >
      <div className="cli-pop__fundo" onClick={opcional ? () => irParaPerguntas() : undefined} />
      <div
        className="cli-pop__folha"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idBase}-pop-titulo`}
        aria-describedby={`${idBase}-pop-texto`}
      >
        <span className={`cli-pop__selo${opcional ? '' : ' cli-pop__selo--obrigatorio'}`}>
          {opcional ? 'Opcional' : 'Obrigatório'}
        </span>
        <H2 className="cli-pop__titulo" id={`${idBase}-pop-titulo`} tabIndex={-1} data-pop-titulo="">
          {opcional ? 'Antes de começar: quer se cadastrar?' : 'Antes de começar, deixe seus dados'}
        </H2>
        <p className="cli-pop__texto" id={`${idBase}-pop-texto`}>
          {opcional ? (
            <>
              <strong>O cadastro é opcional</strong> e leva menos de 1 minuto. Se preferir, responda direto.
            </>
          ) : (
            `Para responder a pesquisa, ${empresa ? `a ${empresa}` : 'a empresa'} precisa dos seus dados. Depois, ${
              totalPerguntas > 1 ? 'são só algumas perguntas rápidas' : 'é só uma pergunta rápida'
            }.`
          )}
        </p>
        <div className="cli-pop__campo">
          <label htmlFor={`${idBase}-c-nome`}>Nome</label>
          <input
            className="cli__campo"
            id={`${idBase}-c-nome`}
            autoComplete="name"
            data-campo-primeiro=""
            value={contato.nome}
            onChange={(e) => mudar('nome', e.target.value)}
            {...invalido('nome')}
          />
          {erro('nome')}
        </div>
        <div className="cli-pop__campo">
          <label htmlFor={`${idBase}-c-telefone`}>WhatsApp ou telefone</label>
          <input
            className="cli__campo"
            id={`${idBase}-c-telefone`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 91234-5678"
            value={contato.telefone}
            onChange={(e) => mudar('telefone', e.target.value)}
            {...invalido('telefone')}
          />
          {erro('telefone')}
        </div>
        <div className="cli-pop__campo">
          <label htmlFor={`${idBase}-c-email`}>
            E-mail <span className="cli-pop__opcional">(opcional)</span>
          </label>
          <input
            className="cli__campo"
            id={`${idBase}-c-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={contato.email}
            onChange={(e) => mudar('email', e.target.value)}
            {...invalido('email')}
          />
          {erro('email')}
        </div>
        <div className="cli-pop__campo">
          <label htmlFor={`${idBase}-c-cpf`}>
            CPF <span className="cli-pop__opcional">(se não tiver telefone)</span>
          </label>
          <input
            className="cli__campo"
            id={`${idBase}-c-cpf`}
            inputMode="numeric"
            autoComplete="off"
            value={contato.cpf}
            onChange={(e) => mudar('cpf', e.target.value)}
            {...invalido('cpf')}
          />
          {erro('cpf')}
        </div>
        <div className="cli-pop__campo">
          <label htmlFor={`${idBase}-c-nascimento`}>
            Data de nascimento <span className="cli-pop__opcional">(opcional)</span>
          </label>
          <input
            className="cli__campo"
            type="date"
            id={`${idBase}-c-nascimento`}
            autoComplete="bday"
            max={hojeIso()}
            value={contato.nascimento}
            onChange={(e) => mudar('nascimento', e.target.value)}
            {...invalido('nascimento')}
          />
          {erro('nascimento')}
        </div>
        <label className="cli__aceite">
          <input type="checkbox" checked={contato.aceite} onChange={(e) => mudar('aceite', e.target.checked)} />
          Aceito receber novidades e ofertas{empresa ? ` da ${empresa}` : ''} (opcional)
        </label>
        {erros.geral && (
          <p className="cli__erro cli__erro--geral" role="alert">
            {erros.geral}
          </p>
        )}
        <div className="cli-pop__acoes">
          <button type="button" className="cli__enviar" onClick={cadastrar}>
            {opcional ? 'Cadastrar e responder' : 'Continuar'}
          </button>
          {opcional && (
            <button type="button" className="cli-pop__depois" onClick={() => irParaPerguntas()}>
              Responder sem cadastro
            </button>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return <>{children({ conteudo, pop, popAberto })}</>;
}
