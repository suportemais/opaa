import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import { randomId } from '../lib/id';
import { Icone } from '../components/painel/Icone';
import { FormularioCliente, type AtendenteCliente, type EnvioCliente } from '../components/survey/FormularioCliente';
import '../styles/painel-pesquisas.css';

type PublicOption = { id: string; label: string; value: string; order: number; negative?: boolean };
type PublicQuestion = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  required: boolean;
  order: number;
  options: PublicOption[];
  config?: unknown;
};
type PublicSurvey = {
  tradeName?: string | null;
  settings?: { badScoreThreshold?: number };
  unit?: { id: string; name: string; googleBusinessUrl: string | null } | null;
  survey: {
    name: string;
    description: string | null;
    introMessage: string | null;
    outroMessage: string | null;
    collectCustomer: boolean;
    anonymousAllowed?: boolean;
    collectEmployee?: boolean;
    questions: PublicQuestion[];
  };
};

function codigoErro(err: unknown) {
  if (err instanceof ApiError) {
    const body = err.body as { message?: unknown } | string | null;
    const msg = body && typeof body === 'object' ? body.message : body;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return err instanceof Error ? err.message : '';
}

/** Pesquisa pública que o cliente responde (link/QR Code da unidade), no visual do protótipo (responder.html). */
export function PublicSurveyPage() {
  const params = useParams();
  const token = params.token ?? '';

  const survey = useQuery({
    queryKey: ['publicSurvey', token],
    queryFn: () => apiFetch<PublicSurvey>(`/public/surveys/${token}`),
    enabled: Boolean(token),
    retry: false,
  });

  const collectEmployee = Boolean(survey.data?.survey.collectEmployee);
  const [busca, setBusca] = useState('');
  const [consulta, setConsulta] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setConsulta(busca), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const employees = useQuery({
    queryKey: ['publicSurveyEmployees', token, consulta],
    queryFn: () =>
      apiFetch<AtendenteCliente[]>(`/public/surveys/${token}/employees?q=${encodeURIComponent(consulta)}`),
    enabled: Boolean(token) && collectEmployee,
  });

  const empresa = survey.data?.tradeName?.trim() || '';
  useEffect(() => {
    if (survey.data) {
      document.title = [survey.data.survey.name, empresa, survey.data.unit?.name].filter(Boolean).join(' — ');
    }
  }, [survey.data, empresa]);

  async function enviar(envio: EnvioCliente) {
    const chave = `opaa_pub_${token}`;
    let idempotencyKey: string | null = null;
    try {
      idempotencyKey = sessionStorage.getItem(chave);
    } catch {
      /* sem armazenamento */
    }
    if (!idempotencyKey) idempotencyKey = randomId(16);
    try {
      sessionStorage.setItem(chave, idempotencyKey);
    } catch {
      /* ignora */
    }
    try {
      await apiFetch<{ responseId: string; npsClass: string }>('/public/responses', {
        method: 'POST',
        json: {
          publicToken: token,
          idempotencyKey,
          employeeId: envio.employeeId,
          complaint: envio.complaint,
          answers: envio.answers,
          customer: envio.customer,
          clientMetadata: { ua: navigator.userAgent },
        },
      });
    } catch (err) {
      const code = codigoErro(err);
      if (code === 'customer_identity_required') throw new Error(code);
      throw new Error('Falha ao enviar. Tente novamente.');
    }
    try {
      sessionStorage.removeItem(chave);
    } catch {
      /* ignora */
    }
  }

  const rodape = (
    <p className="pub__rodape">
      <img src="/icon-opiina.png" alt="" width={16} height={16} />
      Pesquisa feita com Opiina
      <span aria-hidden="true">·</span>
      Desenvolvido por{' '}
      <a href="https://devmais.com" target="_blank" rel="noreferrer">
        Dev+
      </a>
    </p>
  );

  if (survey.isLoading || !token || survey.isError || !survey.data) {
    const carregando = survey.isLoading;
    return (
      <div className="painel pub">
        <main className="pub__pagina">
          <div className="pub__cartao">
            <div className="cli">
              <div className="cli__marca">
                <img src="/icon-opiina.png" alt="" width={22} height={22} />
                Opiina
              </div>
              {carregando ? (
                <p className="cli__desc" role="status">
                  Carregando a pesquisa…
                </p>
              ) : (
                <div className="cli__fim">
                  <span className="cli__fim-icone pub__aviso-icone" aria-hidden="true">
                    <Icone nome="alerta" />
                  </span>
                  <h1 className="cli__titulo">Pesquisa não encontrada</h1>
                  <p className="cli__desc">
                    Confira o link ou aponte a câmera de novo para o QR Code. Se não der certo, avise a equipe da casa.
                  </p>
                </div>
              )}
            </div>
          </div>
          {rodape}
        </main>
      </div>
    );
  }

  const d = survey.data;
  const threshold =
    typeof d.settings?.badScoreThreshold === 'number' && Number.isFinite(d.settings.badScoreThreshold)
      ? Math.round(d.settings.badScoreThreshold)
      : 6;
  const coletarCliente = Boolean(d.survey.collectCustomer);

  return (
    <div className="painel pub">
      <FormularioCliente
        empresa={empresa}
        unidade={d.unit?.name ?? null}
        nome={d.survey.name}
        descricao={d.survey.description}
        introMessage={d.survey.introMessage}
        outroMessage={d.survey.outroMessage}
        perguntas={d.survey.questions.map((q) => ({
          ...q,
          options: q.options.slice().sort((a, b) => a.order - b.order),
        }))}
        coletarAtendente={collectEmployee}
        coletarCliente={coletarCliente}
        clienteObrigatorio={coletarCliente && d.survey.anonymousAllowed === false}
        googleUrl={d.unit?.googleBusinessUrl ?? null}
        badScoreThreshold={threshold}
        atendentes={employees.data}
        atendentesCarregando={employees.isLoading}
        atendentesErro={employees.isError}
        onBuscarAtendente={setBusca}
        onEnviar={enviar}
      >
        {({ conteudo, pop, popAberto }) => (
          <>
            <main className="pub__pagina" inert={popAberto || undefined}>
              <div className="pub__cartao">{conteudo}</div>
              {rodape}
            </main>
            {pop}
          </>
        )}
      </FormularioCliente>
    </div>
  );
}
