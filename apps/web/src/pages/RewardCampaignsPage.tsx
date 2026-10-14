import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { isActiveSurvey } from '../lib/survey-list';
import { Icone } from '../components/painel/Icone';
import { usePode } from '../components/painel/usePainel';
import { useAviso } from '../components/painel/clientes/Aviso';
import { Gaveta } from '../components/painel/clientes/Gaveta';
import { type AcaoCampanha, CampanhaCartao } from '../components/painel/premios/CampanhaCartao';
import { CampanhaForm, type ModoForm } from '../components/painel/premios/CampanhaForm';
import { useConfirmar } from '../components/painel/premios/Confirmar';
import {
  type Campanha,
  type EmpresaMm,
  type Pesquisa,
  type Situacao,
  type UnidadeCnpj,
  MENSAGEM_PADRAO,
  dataCurta,
  erroCampanha,
  opcoesEmpresa,
  real,
  situacaoDa,
} from '../components/painel/premios/util';
import '../styles/painel-premios.css';

// ---------------------------------------------------------------------------
// Prévia de design (só em DEV: /premios-preview ou ?preview=1). Nada disso vai para produção.
// ---------------------------------------------------------------------------
const PREVIEW_PESQUISAS: Pesquisa[] = [
  { id: 's1', name: 'NPS pós-visita', status: 'active' },
  { id: 's2', name: 'CSAT delivery', status: 'active' },
  { id: 's3', name: 'NPS unidade Centro', status: 'active' },
];
const PREVIEW_EMPRESAS: EmpresaMm[] = [{ id: 'mm-company-gepos', tradeName: 'Grupo Geppos' }];
const PREVIEW_UNIDADES: UnidadeCnpj[] = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Unidade Centro', document: '33000167000101', legalName: 'Centro Alimentos LTDA' },
];
const U = PREVIEW_UNIDADES[0];
const PREVIEW_CAMPANHAS: Campanha[] = [
  {
    id: 'c1', name: 'NPS Setembro — R$10', surveyId: 's1', surveyName: 'NPS pós-visita', mmCompanyId: 'mm-company-gepos',
    rewardAmountCents: 1000, validityDays: 30, startsAt: '2026-09-15T12:00:00.000Z', endsAt: '2026-12-15T23:59:00.000Z',
    message: MENSAGEM_PADRAO, prefix: 'MM', status: 'active', perCustomerLimit: 1, issuedCount: 128, redeemedCount: 47,
    unitId: U.id, unitName: U.name, cnpj: U.document, issuer: { cnpj: U.document!, legalName: U.legalName!, tradeName: U.name },
  },
  {
    id: 'c2', name: 'CSAT delivery — R$20', surveyId: 's2', surveyName: 'CSAT delivery', mmCompanyId: 'mm-company-gepos',
    rewardAmountCents: 2000, validityDays: 30, startsAt: null, endsAt: null, message: MENSAGEM_PADRAO, prefix: 'MM',
    status: 'paused', perCustomerLimit: 1, issuedCount: 56, redeemedCount: 12, unitId: U.id, unitName: U.name, cnpj: U.document,
  },
  {
    id: 'c4', name: 'Natal — R$15', surveyId: 's1', surveyName: 'NPS pós-visita', mmCompanyId: 'mm-company-gepos',
    rewardAmountCents: 1500, validityDays: 15, startsAt: '2027-12-01T12:00:00.000Z', endsAt: '2027-12-31T23:59:00.000Z',
    message: MENSAGEM_PADRAO, prefix: 'MM', status: 'active', perCustomerLimit: 1, issuedCount: 0, redeemedCount: 0,
    unitId: U.id, unitName: U.name, cnpj: U.document,
  },
  {
    id: 'c3', name: 'Campanha piloto — R$10', surveyId: 's3', surveyName: 'NPS unidade Centro', mmCompanyId: 'mm-company-gepos',
    rewardAmountCents: 1000, validityDays: 30, startsAt: null, endsAt: null, message: MENSAGEM_PADRAO, prefix: 'MM',
    status: 'finished', perCustomerLimit: 1, issuedCount: 210, redeemedCount: 98, unitId: U.id, unitName: U.name, cnpj: U.document,
  },
];

function isDesignPreview() {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  if (window.location.pathname.startsWith('/premios-preview')) return true;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

type Filtro = 'todas' | 'ativa' | 'agendada' | 'encerrada';
const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'ativa', rotulo: 'Ativas' },
  { id: 'agendada', rotulo: 'Agendadas' },
  { id: 'encerrada', rotulo: 'Encerradas' },
];
const ORDEM: Record<Situacao, number> = { ativa: 0, pausada: 1, rascunho: 2, agendada: 3, encerrada: 4 };
const naFiltro = (f: Filtro, s: Situacao) =>
  f === 'todas' || s === f || (f === 'ativa' && (s === 'pausada' || s === 'rascunho'));

export function RewardCampaignsPage() {
  const qc = useQueryClient();
  const preview = isDesignPreview();
  const pode = usePode();
  // Sem /auth/me na prévia, mostra as ações como antes.
  const podeGerir = preview || pode('survey:manage');
  const [params, setParams] = useSearchParams();
  const filtroUrl = params.get('status') as Filtro | null;
  const filtro: Filtro = FILTROS.some((f) => f.id === filtroUrl) ? (filtroUrl as Filtro) : 'todas';
  const [aviso, avisar] = useAviso();
  const [confirmacao, confirmar] = useConfirmar();
  const [form, setForm] = useState<{ modo: ModoForm; campanha: Campanha | null } | null>(null);

  const surveys = useQuery({ queryKey: ['surveys'], queryFn: () => apiFetch<Pesquisa[]>('/surveys'), enabled: !preview });
  const campaigns = useQuery({
    queryKey: ['coupon-campaigns'],
    queryFn: () => apiFetch<Campanha[]>('/coupon-campaigns'),
    enabled: !preview,
  });
  const mmCompanies = useQuery({
    queryKey: ['mm-companies'],
    queryFn: () => apiFetch<EmpresaMm[]>('/mm-companies'),
    staleTime: 60 * 1000,
    enabled: !preview,
  });
  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<UnidadeCnpj[]>('/units'), enabled: !preview });

  const pesquisas = useMemo(() => (preview ? PREVIEW_PESQUISAS : (surveys.data ?? []).filter(isActiveSurvey)), [preview, surveys.data]);
  const campanhas = useMemo(() => (preview ? PREVIEW_CAMPANHAS : (campaigns.data ?? [])), [preview, campaigns.data]);
  const empresas = useMemo(() => (preview ? PREVIEW_EMPRESAS : (mmCompanies.data ?? [])), [preview, mmCompanies.data]);
  const unidades = useMemo(() => (preview ? PREVIEW_UNIDADES : (units.data ?? [])), [preview, units.data]);
  const unidadePorId = useMemo(() => new Map(unidades.map((u) => [u.id, u])), [unidades]);

  const comSituacao = useMemo(() => {
    const agora = Date.now();
    return campanhas.map((c) => ({ c, s: situacaoDa(c, agora) }));
  }, [campanhas]);
  const itens = comSituacao
    .filter(({ s }) => naFiltro(filtro, s))
    .sort((a, b) => ORDEM[a.s] - ORDEM[b.s] || (b.c.startsAt ?? '').localeCompare(a.c.startsAt ?? ''));

  // Resumo
  const ativas = comSituacao.filter(({ s }) => s === 'ativa').length;
  const enviados = campanhas.reduce((t, c) => t + (c.issuedCount ?? 0), 0);
  const resgatados = campanhas.reduce((t, c) => t + (c.redeemedCount ?? 0), 0);
  const valorResgatado = campanhas.reduce((t, c) => t + (c.redeemedCount ?? 0) * (c.rewardAmountCents ?? 0), 0);
  const taxa = enviados ? Math.round((resgatados / enviados) * 100) : 0;
  const nfmt = (v: number) => v.toLocaleString('pt-BR');

  const semIntegracao = !preview && !mmCompanies.isLoading && !mmCompanies.isError && empresas.length === 0;

  const acao = useMutation({
    mutationFn: ({ tipo, id }: { tipo: 'pause' | 'activate' | 'finish'; id: string }) =>
      apiFetch<Campanha>(`/coupon-campaigns/${id}/${tipo}`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['coupon-campaigns'] });
    },
  });

  async function executar(a: AcaoCampanha, c: Campanha) {
    if (a === 'editar') return setForm({ modo: 'editar', campanha: c });
    if (a === 'modelo') return setForm({ modo: 'modelo', campanha: c });
    try {
      if (a === 'pausar') {
        await acao.mutateAsync({ tipo: 'pause', id: c.id });
        return avisar(`${c.name}: pausada. Novos clientes não recebem voucher até você retomar.`);
      }
      if (a === 'retomar') {
        await acao.mutateAsync({ tipo: 'activate', id: c.id });
        return avisar(`${c.name}: ativa de novo`);
      }
      // Encerrar e "Cancelar campanha agendada": as duas só mudam o status para encerrada (nada é apagado).
      const cancelar = a === 'cancelar';
      const ok = await confirmar({
        titulo: cancelar ? 'Cancelar esta campanha?' : 'Encerrar esta campanha?',
        texto: cancelar ? (
          <>
            <strong>{c.name}</strong> ainda não começou e não vai enviar vouchers. Ela fica na lista como encerrada.
          </>
        ) : (
          <>
            <strong>{c.name}</strong> para de enviar vouchers agora. Os números até aqui continuam no histórico. Não dá para
            reabrir; para repetir, use “Usar como modelo”.
          </>
        ),
        botao: cancelar ? 'Cancelar campanha' : 'Encerrar',
        botaoVoltar: 'Voltar',
        perigo: true,
        icone: 'alerta',
      });
      if (!ok) return;
      await acao.mutateAsync({ tipo: 'finish', id: c.id });
      avisar(cancelar ? `${c.name}: cancelada` : `${c.name}: encerrada`);
    } catch (err) {
      avisar(erroCampanha(err));
    }
  }

  function mudarFiltro(f: Filtro) {
    setParams(
      (atual) => {
        const p = new URLSearchParams(atual);
        if (f === 'todas') p.delete('status');
        else p.set('status', f);
        return p;
      },
      { replace: true },
    );
  }

  const carregando = !preview && campaigns.isLoading;

  return (
    <>
      <div className="cabeca">
        <div>
          <h1 className="cabeca__titulo">Prêmios</h1>
          <p className="cabeca__desc">Vouchers Muito Mais em R$ para quem responde às pesquisas, enviados por WhatsApp.</p>
        </div>
        {podeGerir && (
          <div className="cabeca__acoes">
            <button className="btn btn--primario" type="button" aria-haspopup="dialog" onClick={() => setForm({ modo: 'nova', campanha: null })}>
              <Icone nome="mais" />
              Nova campanha
            </button>
          </div>
        )}
      </div>

      {semIntegracao && (
        <div className="cartao pr-aviso">
          <Icone nome="plug" />
          <div>
            <strong>A Muito Mais não está conectada</strong>
            <p>É ela que gera os vouchers. Sem a conexão, as campanhas não enviam prêmios.</p>
          </div>
          <Link className="btn btn--secundario" to="/app/integracoes">
            Conectar em Integrações
          </Link>
        </div>
      )}

      <section className="kpis" aria-label="Resumo das campanhas">
        <article className="kpi">
          <p className="kpi__rotulo">Campanhas ativas</p>
          <p className="kpi__valor">{ativas}</p>
          <p className="kpi__nota">{campanhas.length} no total</p>
        </article>
        <article className="kpi">
          <p className="kpi__rotulo">Vouchers enviados</p>
          <p className="kpi__valor">{nfmt(enviados)}</p>
          <p className="kpi__nota">Em todas as campanhas</p>
        </article>
        <article className="kpi">
          <p className="kpi__rotulo">Resgatados</p>
          <p className="kpi__valor">{taxa}%</p>
          <p className="kpi__nota">
            {nfmt(resgatados)} de {nfmt(enviados)} vouchers
          </p>
        </article>
        <article className="kpi">
          <p className="kpi__rotulo">Valor resgatado</p>
          <p className="kpi__valor">{real(valorResgatado)}</p>
          <p className="kpi__nota">Soma dos vouchers usados</p>
        </article>
      </section>

      <div className="alternar" role="group" aria-label="Mostrar campanhas">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => mudarFiltro(f.id)}>
            {f.rotulo} <span className="alternar__total">{comSituacao.filter(({ s }) => naFiltro(f.id, s)).length}</span>
          </button>
        ))}
      </div>

      {carregando && <p className="mudo">Carregando…</p>}
      {!preview && campaigns.isError && (
        <div className="cartao vazio">
          <strong>Não foi possível carregar as campanhas</strong>
          Tente recarregar a página.
        </div>
      )}
      {!carregando && itens.length > 0 && (
        <ul className="pq-lista" aria-busy={acao.isPending || undefined}>
          {itens.map(({ c, s }) => (
            <CampanhaCartao
              key={c.id}
              campanha={c}
              situacao={s}
              unidade={c.unitId ? unidadePorId.get(c.unitId) : undefined}
              podeGerir={podeGerir}
              ocupado={acao.isPending && acao.variables?.id === c.id}
              onAcao={executar}
            />
          ))}
        </ul>
      )}
      {!carregando && !campaigns.isError && itens.length === 0 && (
        <div className="cartao vazio">
          <strong>{campanhas.length ? 'Nenhuma campanha aqui' : 'Nenhuma campanha ainda'}</strong>
          {campanhas.length ? 'Escolha outro filtro ou crie uma em “Nova campanha”.' : 'Crie a primeira em “Nova campanha”.'}
        </div>
      )}

      <Gaveta aberta={Boolean(form)} onFechar={() => setForm(null)} rotuloId="pr-titulo" larga focoInicial="pr-nome">
        {form && (
          <CampanhaForm
            modo={form.modo}
            inicial={form.campanha}
            pesquisas={pesquisas}
            empresas={opcoesEmpresa(empresas, form.campanha?.mmCompanyId)}
            empresasCarregando={!preview && mmCompanies.isLoading}
            empresasErro={!preview && mmCompanies.isError}
            unidades={unidades}
            unidadesCarregando={!preview && units.isLoading}
            onFechar={() => setForm(null)}
            onSalvo={(c, modo, agendada) => {
              setForm(null);
              avisar(
                modo === 'editar'
                  ? `${c.name}: alterações salvas`
                  : agendada
                    ? `${c.name}: agendada para ${dataCurta(c.startsAt)}`
                    : `${c.name}: ativa`,
              );
            }}
          />
        )}
      </Gaveta>

      {confirmacao}
      {aviso}
    </>
  );
}
