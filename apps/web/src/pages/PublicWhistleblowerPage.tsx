import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { randomId } from '../lib/id';
import { whistleblowerCategoryLabel } from '../lib/labels';
import { Icone } from '../components/painel/Icone';
import { CATEGORIAS } from '../components/painel/denuncias/comum';
import '../styles/painel-denuncias.css';

type PublicFormData = {
  tenant: { id: string; slug: string; tradeName: string; legalName: string };
  units: Array<{ id: string; name: string; internalCode: string | null }>;
};

type SubmitResult = {
  id: string;
  protocol: string;
  publicToken: string;
  anonymous: boolean;
  status: string;
  priority: string;
  createdAt: string;
  message: string;
};

type Campo =
  | 'category'
  | 'customCategory'
  | 'title'
  | 'description'
  | 'occurredAt'
  | 'reporter'
  | 'reporterEmail'
  | 'truthfulness';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Marca({ nome }: { nome: string }) {
  return (
    <div className="cli__marca">
      <img src="/icon-opiina.png" alt="" />
      {nome}
    </div>
  );
}

function Pagina({ children }: { children: ReactNode }) {
  return (
    <div className="painel pub">
      <main className="pub__pagina">
        <div className="pub__cartao pub__cartao--largo">{children}</div>
        <p className="pub__rodape">
          <img src="/icon-opiina.png" alt="" width={16} height={16} />
          Canal de ética com Opiina · desenvolvido por{' '}
          <a href="https://devmais.com" target="_blank" rel="noreferrer">
            Dev+
          </a>
        </p>
      </main>
    </div>
  );
}

export function PublicWhistleblowerPage() {
  const params = useParams();
  const tenantSlug = params.tenantSlug ?? '';

  const form = useQuery({
    queryKey: ['publicWhistleblowerForm', tenantSlug],
    queryFn: () => apiFetch<PublicFormData>(`/public/whistleblower/${tenantSlug}`),
    enabled: Boolean(tenantSlug),
    retry: false,
  });

  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [unitId, setUnitId] = useState('');
  const [locationText, setLocationText] = useState('');
  const [involvedPeople, setInvolvedPeople] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [anonymous, setAnonymous] = useState(true);
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterDoc, setReporterDoc] = useState('');

  const [truthfulnessAgreement, setTruthfulnessAgreement] = useState(false);
  const [erros, setErros] = useState<Partial<Record<Campo, boolean>>>({});
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const confirmarRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fimRef = useRef<HTMLHeadingElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const idempotencia = useRef(randomId(24));

  const submit = useMutation({
    mutationFn: async () => {
      const dto = {
        idempotencyKey: idempotencia.current,
        category,
        customCategory: category === 'other' ? customCategory.trim() || undefined : undefined,
        title: title.trim(),
        description: description.trim(),
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
        unitId: unitId || undefined,
        locationText: locationText.trim() || undefined,
        involvedPeople: involvedPeople.trim() || undefined,
        witnesses: witnesses.trim() || undefined,
        additionalInfo: additionalInfo.trim() || undefined,
        anonymous,
        truthfulnessAgreement,
        reporter: anonymous
          ? undefined
          : {
              name: reporterName.trim() || undefined,
              email: reporterEmail.trim() || undefined,
              phone: reporterPhone.trim() || undefined,
              doc: reporterDoc.trim() || undefined,
            },
      };
      return apiFetch<SubmitResult>(`/public/whistleblower/${tenantSlug}`, { method: 'POST', json: dto });
    },
  });

  useEffect(() => {
    if (submit.data) {
      window.scrollTo(0, 0);
      fimRef.current?.focus();
    }
  }, [submit.data]);

  function validar() {
    const e: Partial<Record<Campo, boolean>> = {
      category: !category,
      customCategory: category === 'other' && !customCategory.trim(),
      title: !title.trim(),
      description: !description.trim(),
      occurredAt: Boolean(occurredAt) && Number.isNaN(new Date(occurredAt).getTime()),
      reporter:
        !anonymous && !reporterName.trim() && !reporterEmail.trim() && !reporterPhone.trim() && !reporterDoc.trim(),
      reporterEmail: !anonymous && Boolean(reporterEmail.trim()) && !EMAIL_OK.test(reporterEmail.trim()),
      truthfulness: !truthfulnessAgreement,
    };
    return e;
  }

  // Depois da primeira tentativa, os destaques acompanham o que a pessoa corrige
  useEffect(() => {
    if (tentouEnviar) setErros(validar());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tentouEnviar,
    category,
    customCategory,
    title,
    description,
    occurredAt,
    anonymous,
    reporterName,
    reporterEmail,
    reporterPhone,
    reporterDoc,
    truthfulnessAgreement,
  ]);

  function aoEnviar(ev: FormEvent) {
    ev.preventDefault();
    const e = validar();
    setErros(e);
    setTentouEnviar(true);
    if (Object.values(e).some(Boolean)) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    confirmarRef.current?.showModal();
  }

  const qtdErros = Object.values(erros).filter(Boolean).length;
  const inv = (c: Campo) => (erros[c] ? true : undefined);

  if (form.isLoading) {
    return (
      <Pagina>
        <div className="canal">
          <p className="cli__desc">Carregando…</p>
        </div>
      </Pagina>
    );
  }

  if (form.isError || !form.data) {
    return (
      <Pagina>
        <div className="canal">
          <Marca nome="Opiina" />
          <h1 className="cli__titulo">Canal de denúncias indisponível</h1>
          <p className="cli__desc">Canal de denúncias não encontrado ou indisponível. Confira o link recebido.</p>
        </div>
      </Pagina>
    );
  }

  const empresa = form.data.tenant.tradeName;

  if (submit.data) {
    const r = submit.data;
    return (
      <Pagina>
        <div className="canal">
          <Marca nome={empresa} />
          <div className="cli__fim canal__fim">
            <span className="cli__fim-icone" aria-hidden="true">
              <Icone nome="ok" />
            </span>
            <h1 className="cli__titulo" tabIndex={-1} ref={fimRef}>
              Denúncia enviada
            </h1>
            <p className="cli__desc">
              {r.anonymous ? (
                <>
                  Ela foi enviada <strong>sem seu nome e sem contato</strong>.
                </>
              ) : (
                'O time responsável pode falar com você pelo contato que deixou.'
              )}
            </p>
            {r.message && <p className="cli__desc">{r.message}</p>}
            <div className="canal__protocolo">
              <span>Protocolo</span>
              <strong id="canal-protocolo">{r.protocol}</strong>
              <span className="den-recebida">Recebida em {new Date(r.createdAt).toLocaleString('pt-BR')}</span>
              <button
                className="btn btn--secundario"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(r.protocol);
                    setCopiado('Protocolo copiado');
                  } catch {
                    const el = document.getElementById('canal-protocolo');
                    if (el) window.getSelection()?.selectAllChildren(el);
                    setCopiado('Selecionado: copie com Ctrl+C');
                  }
                }}
              >
                <Icone nome="link" />
                {copiado ?? 'Copiar protocolo'}
              </button>
            </div>
            <p className="cli__desc">
              Guarde este número em local seguro: ele identifica sua denúncia em consultas e no acompanhamento junto ao comitê de
              ética.
            </p>
            <p className="cli__desc">Obrigado por contribuir com a integridade e segurança da empresa. Pode fechar esta página.</p>
          </div>
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <div className="canal">
        <Marca nome={empresa} />

        <div className="canal__topo">
          <h1 className="cli__titulo">Canal de denúncias</h1>
          <p className="cli__desc">
            Para a equipe relatar assédio, discriminação, fraude, risco à segurança ou outra conduta errada no trabalho. O relato vai
            para o time responsável pelo canal de ética.
          </p>
        </div>

        <ul className="canal__garantias">
          <li>
            <Icone nome="cadeado" />
            <span>
              <strong>Você pode ficar anônimo.</strong> Sem nome e sem contato, ninguém sabe quem enviou.
            </span>
          </li>
          <li>
            <Icone nome="ok" />
            <span>
              <strong>Sem login.</strong> Não precisa de cadastro nem de senha.
            </span>
          </li>
          <li>
            <Icone nome="lista" />
            <span>
              <strong>Você recebe um protocolo</strong> ao enviar.
            </span>
          </li>
        </ul>

        <p className="canal__urgente" role="note">
          <Icone nome="alerta" />
          <span>
            Se alguém está em perigo agora, ligue <strong>190</strong> (Polícia) ou <strong>192</strong> (SAMU). Este canal não é
            atendido em tempo real.
          </span>
        </p>

        <details className="den-lgpd">
          <summary>Aviso de confidencialidade e LGPD</summary>
          <div>
            <p>
              Este canal destina-se ao recebimento de denúncias relacionadas a racismo, injúria racial, homofobia, transfobia,
              intolerância religiosa, assédio de qualquer natureza, violência e demais formas de discriminação ou condutas inadequadas
              ocorridas no ambiente de trabalho.
            </p>
            <p>
              As informações fornecidas serão tratadas com confidencialidade e utilizadas exclusivamente para a apuração dos fatos
              relatados, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD). O acesso aos dados
              será restrito às pessoas autorizadas e, quando necessário, as informações poderão ser compartilhadas para fins de
              investigação e cumprimento de obrigações legais e regulatórias.
            </p>
            <p>
              O denunciante poderá optar por permanecer anônimo, sendo asseguradas a confidencialidade das informações e a não
              retaliação contra pessoas que apresentem denúncias fundamentadas.
            </p>
          </div>
        </details>

        <form className="canal__form" noValidate onSubmit={aoEnviar} ref={formRef}>
          <div className="campo">
            <label htmlFor="d-categoria">
              Sobre o que é a denúncia? <span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <select
              id="d-categoria"
              required
              aria-invalid={inv('category')}
              aria-describedby="d-categoria-erro"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Escolha uma categoria</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c === 'other' ? 'Outro (descreva)' : whistleblowerCategoryLabel(c)}
                </option>
              ))}
            </select>
            <p className="campo__erro" id="d-categoria-erro" hidden={!erros.category}>
              Escolha a categoria. Se nenhuma servir, escolha "Outro".
            </p>
          </div>

          {category === 'other' && (
            <div className="campo">
              <label htmlFor="d-outra">
                Qual categoria? <span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <input
                id="d-outra"
                required
                maxLength={120}
                autoComplete="off"
                placeholder="Ex.: assédio moral virtual"
                aria-invalid={inv('customCategory')}
                aria-describedby="d-outra-erro"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
              <p className="campo__erro" id="d-outra-erro" hidden={!erros.customCategory}>
                Descreva a categoria "Outro".
              </p>
            </div>
          )}

          <div className="campos-2">
            <div className="campo">
              <label htmlFor="d-unidade">Onde aconteceu?</label>
              <select id="d-unidade" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Prefiro não dizer</option>
                {form.data.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.internalCode ? ` (${u.internalCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="d-quando">
                Quando aconteceu? <span className="opcional">(opcional)</span>
              </label>
              <input
                id="d-quando"
                type="date"
                max={hojeISO()}
                aria-invalid={inv('occurredAt')}
                aria-describedby="d-quando-erro"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
              <p className="campo__erro" id="d-quando-erro" hidden={!erros.occurredAt}>
                Data inválida.
              </p>
            </div>
          </div>

          <div className="campo">
            <label htmlFor="d-local">
              Local ou endereço <span className="opcional">(opcional)</span>
            </label>
            <input
              id="d-local"
              maxLength={200}
              placeholder="Se preferir, descreva o local em texto livre"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
          </div>

          <div className="campo">
            <label htmlFor="d-resumo">
              Resumo em uma frase <span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <input
              id="d-resumo"
              required
              maxLength={200}
              autoComplete="off"
              placeholder="Ex.: Gerente grita com a equipe na frente dos clientes"
              aria-invalid={inv('title')}
              aria-describedby="d-resumo-erro"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="campo__erro" id="d-resumo-erro" hidden={!erros.title}>
              Escreva um resumo curto.
            </p>
          </div>

          <div className="campo">
            <label htmlFor="d-relato">
              O que aconteceu? <span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <textarea
              id="d-relato"
              rows={6}
              required
              maxLength={20000}
              aria-invalid={inv('description')}
              aria-describedby="d-relato-dica d-relato-erro"
              placeholder="Conte o que aconteceu, com datas, locais e contexto. Quanto mais detalhes, mais fácil apurar."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="campo__dica" id="d-relato-dica">
              Se quiser ficar anônimo, não escreva seu nome nem detalhes que identifiquem você.
            </p>
            <p className="campo__erro" id="d-relato-erro" hidden={!erros.description}>
              Conte o que aconteceu.
            </p>
          </div>

          <fieldset className="den-mais">
            <legend className="campo__rotulo">
              Detalhes que ajudam a apurar <span className="opcional">(opcional)</span>
            </legend>
            <div className="campo">
              <label htmlFor="d-envolvidos">Pessoas envolvidas</label>
              <textarea
                id="d-envolvidos"
                maxLength={2000}
                placeholder="Nomes, cargos, vínculos ou qualquer informação relevante das pessoas diretamente envolvidas."
                value={involvedPeople}
                onChange={(e) => setInvolvedPeople(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="d-testemunhas">Testemunhas</label>
              <textarea
                id="d-testemunhas"
                maxLength={2000}
                placeholder="Se houver, liste ou descreva testemunhas e seus contatos, se você tiver."
                value={witnesses}
                onChange={(e) => setWitnesses(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="d-adicionais">Informações adicionais</label>
              <textarea
                id="d-adicionais"
                maxLength={2000}
                placeholder="Qualquer outro contexto, prova, links ou observações úteis para a apuração."
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset className="canal__ident">
            <legend className="campo__rotulo">Como você quer enviar?</legend>
            <label className="cl-opcao">
              <input type="radio" name="ident" value="anonima" checked={anonymous} onChange={() => setAnonymous(true)} />
              <span>
                <strong>Anônimo</strong>Sem nome e sem contato. Não dá para falarem com você.
              </span>
            </label>
            <label className="cl-opcao">
              <input
                type="radio"
                name="ident"
                value="identificada"
                checked={!anonymous}
                onChange={() => {
                  setAnonymous(false);
                  requestAnimationFrame(() => nomeRef.current?.focus());
                }}
              />
              <span>
                <strong>Com meu nome</strong>O time responsável pode falar com você para entender melhor.
              </span>
            </label>
          </fieldset>

          {!anonymous && (
            <div className="den-identificacao">
              <p className="campo__dica" id="d-ident-dica">
                Nunca pediremos login ou senha. Preencha ao menos um dos campos; seus dados serão usados apenas para contato sobre esta
                denúncia.
              </p>
              <div className="campos-2">
                <div className="campo">
                  <label htmlFor="d-nome">Seu nome</label>
                  <input
                    id="d-nome"
                    ref={nomeRef}
                    autoComplete="name"
                    maxLength={200}
                    aria-invalid={inv('reporter')}
                    aria-describedby="d-ident-dica d-ident-erro"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="d-email">E-mail</label>
                  <input
                    id="d-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={200}
                    placeholder="voce@email.com"
                    aria-invalid={inv('reporterEmail')}
                    aria-describedby="d-email-erro"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                  />
                  <p className="campo__erro" id="d-email-erro" hidden={!erros.reporterEmail}>
                    Confira o e-mail (ex.: voce@email.com).
                  </p>
                </div>
                <div className="campo">
                  <label htmlFor="d-telefone">WhatsApp ou telefone</label>
                  <input
                    id="d-telefone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={50}
                    placeholder="(11) 90000-0000"
                    value={reporterPhone}
                    onChange={(e) => setReporterPhone(e.target.value)}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="d-doc">
                    Documento <span className="opcional">(CPF, matrícula etc.)</span>
                  </label>
                  <input
                    id="d-doc"
                    maxLength={50}
                    autoComplete="off"
                    value={reporterDoc}
                    onChange={(e) => setReporterDoc(e.target.value)}
                  />
                </div>
              </div>
              <p className="campo__erro" id="d-ident-erro" hidden={!erros.reporter}>
                Preencha ao menos um campo ou escolha "Anônimo".
              </p>
            </div>
          )}

          <div className="campo">
            <label className="cli__aceite den-aceite" htmlFor="d-veracidade">
              <input
                id="d-veracidade"
                type="checkbox"
                required
                aria-invalid={inv('truthfulness')}
                aria-describedby="d-veracidade-erro"
                checked={truthfulnessAgreement}
                onChange={(e) => setTruthfulnessAgreement(e.target.checked)}
              />
              <span>
                Declaro, sob minha responsabilidade, que as informações prestadas são verdadeiras, conforme meu conhecimento, e foram
                fornecidas de boa-fé e de forma legítima. <span className="obrigatorio" aria-hidden="true">*</span>
              </span>
            </label>
            <p className="campo__erro" id="d-veracidade-erro" hidden={!erros.truthfulness}>
              Marque a declaração de veracidade para enviar.
            </p>
          </div>

          {qtdErros > 0 && (
            <p className="cli__erro cli__erro--geral" role="alert">
              Confira {qtdErros === 1 ? 'o campo destacado' : `os ${qtdErros} campos destacados`}.
            </p>
          )}
          {submit.isError && (
            <p className="cli__erro cli__erro--geral" role="alert">
              Falha ao enviar a denúncia. Confira os campos obrigatórios e tente novamente.
            </p>
          )}

          <button className="cli__enviar" type="submit" disabled={submit.isPending}>
            {submit.isPending ? 'Enviando…' : 'Enviar denúncia'}
          </button>
        </form>
      </div>

      <dialog ref={confirmarRef} className="confirmar" aria-labelledby="canal-confirmar-titulo">
        <span className="confirmar__icone" aria-hidden="true">
          <Icone nome="alerta" />
        </span>
        <h2 id="canal-confirmar-titulo">Confirmar envio?</h2>
        <p>
          {anonymous ? (
            <>
              Ela vai <strong>sem seu nome e sem contato</strong>.{' '}
            </>
          ) : null}
          Após enviar, você receberá um número de protocolo para acompanhamento.
        </p>
        <div className="confirmar__acoes">
          <button className="btn btn--secundario" type="button" onClick={() => confirmarRef.current?.close()}>
            Voltar
          </button>
          <button
            className="btn btn--primario"
            type="button"
            disabled={submit.isPending}
            onClick={() => {
              confirmarRef.current?.close();
              submit.mutate();
            }}
          >
            Sim, enviar agora
          </button>
        </div>
      </dialog>
    </Pagina>
  );
}
