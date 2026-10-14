import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { env } from '../lib/env';
import { SubscriptionCard } from '../components/billing/SubscriptionCard';
import { ConfigLayout } from '../components/painel/ConfigTabs';
import { useAvisar } from '../components/painel/config/hooks';
import { descr, mensagemDoErro } from '../components/painel/config/erros';
import '../styles/painel-config.css';

type TenantMe = {
  id: string;
  slug: string;
  legalName: string;
  tradeName: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  segment: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  status: string;
  settings?: { badScoreThreshold?: number };
  createdAt: string;
};

const SEGMENTOS = [
  'Restaurante',
  'Bar',
  'Cafeteria',
  'Padaria',
  'Clínica',
  'Odontologia',
  'Academia',
  'Estética',
  'Oficina',
  'Varejo',
  'Hotelaria',
  'Educação',
  'Serviços',
];

const ERROS_EMPRESA: Record<string, string> = {
  invalid_document: 'Confira o CNPJ ou CPF: o número não é válido.',
  cnpj_lookup_failed: 'Não conseguimos consultar esse CNPJ na Receita Federal agora. Confira o número ou tente de novo.',
  validation: 'Confira os campos destacados.',
};

const emailValido = (v: string) => /^\S+@\S+\.\S+$/.test(v);
const corValida = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

type Form = {
  legalName: string;
  tradeName: string;
  document: string;
  email: string;
  phone: string;
  segment: string;
  primaryColor: string;
  secondaryColor: string;
  threshold: string;
};

export function CompanyPage() {
  const qc = useQueryClient();
  const [avisar, aviso] = useAvisar();

  const tenant = useQuery({
    queryKey: ['tenantMe'],
    queryFn: () => apiFetch<TenantMe>('/tenant/me'),
  });

  const badScoreThreshold = useMemo(() => {
    const v = tenant.data?.settings?.badScoreThreshold;
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 6;
  }, [tenant.data]);

  const inicial = useMemo<Form | null>(() => {
    const t = tenant.data;
    if (!t) return null;
    return {
      legalName: t.legalName ?? '',
      tradeName: t.tradeName ?? '',
      document: t.document ?? '',
      email: t.email ?? '',
      phone: t.phone ?? '',
      segment: t.segment ?? '',
      primaryColor: t.primaryColor ?? '',
      secondaryColor: t.secondaryColor ?? '',
      threshold: String(badScoreThreshold),
    };
  }, [tenant.data, badScoreThreshold]);

  const [form, setForm] = useState<Form | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!inicial) return;
    setForm(inicial);
    setAlterado(false);
  }, [inicial]);

  // Sair da página com alterações não salvas: o navegador pergunta antes
  useEffect(() => {
    if (!alterado) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [alterado]);

  const mudar = (campo: keyof Form, valor: string) => {
    setForm((f) => (f ? { ...f, [campo]: valor } : f));
    setAlterado(true);
    setStatus('Alterações não salvas');
  };

  const fantasiaRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const notaRef = useRef<HTMLInputElement>(null);

  const thresholdNum = Number(form?.threshold);
  const erros = form
    ? {
        tradeName: !form.tradeName.trim(),
        email: Boolean(form.email.trim()) && !emailValido(form.email.trim()),
        threshold: !Number.isInteger(thresholdNum) || thresholdNum < 1 || thresholdNum > 10,
      }
    : { tradeName: false, email: false, threshold: false };

  const updateTenant = useMutation({
    mutationFn: async (f: Form) => {
      const threshold = Number(f.threshold);
      return apiFetch<TenantMe>('/tenant/me', {
        method: 'PATCH',
        json: {
          legalName: f.legalName.trim() || undefined,
          tradeName: f.tradeName.trim() || undefined,
          document: f.document.trim() || undefined,
          email: f.email.trim() || undefined,
          phone: f.phone.trim() || undefined,
          segment: f.segment.trim() || undefined,
          primaryColor: f.primaryColor.trim() || undefined,
          secondaryColor: f.secondaryColor.trim() || undefined,
          badScoreThreshold: Number.isFinite(threshold) ? threshold : undefined,
        },
      });
    },
    onSuccess: async () => {
      setAlterado(false);
      setStatus('');
      avisar('Dados da empresa salvos');
      await qc.invalidateQueries({ queryKey: ['tenantMe'] });
      await qc.invalidateQueries({ queryKey: ['surveys'] });
    },
    onError: (err) => setStatus(mensagemDoErro(err, ERROS_EMPRESA, 'Não foi possível salvar. Tente de novo.')),
  });

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setTentou(true);
    if (erros.tradeName) return fantasiaRef.current?.focus();
    if (erros.email) return emailRef.current?.focus();
    if (erros.threshold) return notaRef.current?.focus();
    updateTenant.mutate(form);
  }

  const enderecoPainel = tenant.data
    ? env.appBaseDomain
      ? `${tenant.data.slug}.${env.appBaseDomain}`
      : tenant.data.slug
    : '';

  return (
    <ConfigLayout>
      <div className="cfg__pilha">
        <SubscriptionCard />

        {tenant.isLoading && (
          <div className="cartao cfg__cartao">
            <p className="mudo">Carregando os dados da empresa…</p>
          </div>
        )}
        {tenant.isError && (
          <div className="cartao cfg__cartao">
            <p className="campo__erro" role="alert">
              Não foi possível carregar os dados da empresa.
            </p>
          </div>
        )}

        {form && tenant.data && (
          <form className="cfg__pilha" noValidate onSubmit={salvar} aria-labelledby="t-empresa">
            <div className="cartao cfg__cartao">
              <div className="cfg__topo">
                <div>
                  <h2 className="cartao__titulo" id="t-empresa">
                    Dados da empresa
                  </h2>
                  <p className="cartao__sub">Aparecem para a equipe no painel. O nome fantasia também aparece na pesquisa.</p>
                </div>
              </div>

              <div className="campo">
                <label htmlFor="e-documento">
                  CNPJ ou CPF <span className="opcional">(opcional)</span>
                </label>
                <input
                  id="e-documento"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="00.000.000/0000-00"
                  aria-describedby="e-documento-dica"
                  value={form.document}
                  onChange={(e) => mudar('document', e.target.value)}
                />
                <p className="campo__dica" id="e-documento-dica">
                  Ao salvar um CNPJ, buscamos a razão social e o nome fantasia nos dados públicos da Receita Federal
                  (só preenchemos o que estiver vazio).
                </p>
              </div>

              <div className="cfg__grade">
                <div className="campo">
                  <label htmlFor="e-fantasia">
                    Nome fantasia <span className="obrigatorio" aria-hidden="true">*</span>
                  </label>
                  <input
                    ref={fantasiaRef}
                    id="e-fantasia"
                    required
                    aria-invalid={tentou && erros.tradeName}
                    aria-describedby={descr('e-fantasia', false, true)}
                    value={form.tradeName}
                    onChange={(e) => mudar('tradeName', e.target.value)}
                  />
                  <p className="campo__erro" id="e-fantasia-erro" hidden={!(tentou && erros.tradeName)}>
                    Escreva o nome fantasia.
                  </p>
                </div>
                <div className="campo">
                  <label htmlFor="e-razao">
                    Razão social <span className="opcional">(opcional)</span>
                  </label>
                  <input id="e-razao" value={form.legalName} onChange={(e) => mudar('legalName', e.target.value)} />
                </div>
                <div className="campo">
                  <label htmlFor="e-segmento">
                    Segmento <span className="opcional">(opcional)</span>
                  </label>
                  <input
                    id="e-segmento"
                    list="cfg-segmentos"
                    placeholder="Ex.: Restaurante"
                    value={form.segment}
                    onChange={(e) => mudar('segment', e.target.value)}
                  />
                  <datalist id="cfg-segmentos">
                    {SEGMENTOS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div className="campo">
                  <label htmlFor="e-email">
                    E-mail de contato <span className="opcional">(opcional)</span>
                  </label>
                  <input
                    ref={emailRef}
                    id="e-email"
                    type="email"
                    autoComplete="email"
                    placeholder="contato@suaempresa.com.br"
                    aria-invalid={tentou && erros.email}
                    aria-describedby={descr('e-email', false, true)}
                    value={form.email}
                    onChange={(e) => mudar('email', e.target.value)}
                  />
                  <p className="campo__erro" id="e-email-erro" hidden={!(tentou && erros.email)}>
                    Confira o e-mail (ex.: contato@suaempresa.com.br).
                  </p>
                </div>
                <div className="campo">
                  <label htmlFor="e-telefone">
                    Telefone <span className="opcional">(opcional)</span>
                  </label>
                  <input
                    id="e-telefone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    value={form.phone}
                    onChange={(e) => mudar('phone', e.target.value)}
                  />
                </div>
              </div>

              <div className="cfg__fixo">
                <span className="cfg__fixo-rotulo">Endereço do painel</span>
                <strong>{enderecoPainel}</strong>
                <span className="campo__dica">Definido no cadastro da conta. Não muda por aqui.</span>
              </div>
            </div>

            <div className="cartao cfg__cartao">
              <div className="cfg__topo">
                <div>
                  <h2 className="cartao__titulo">Pesquisa e identidade visual</h2>
                  <p className="cartao__sub">Cores usadas na pesquisa pública e a nota que abre reclamação.</p>
                </div>
              </div>
              <div className="cfg__grade">
                <CampoCor
                  id="e-cor1"
                  rotulo="Cor primária"
                  valor={form.primaryColor}
                  padrao="#0ea5e9"
                  onChange={(v) => mudar('primaryColor', v)}
                />
                <CampoCor
                  id="e-cor2"
                  rotulo="Cor secundária"
                  valor={form.secondaryColor}
                  padrao="#0f172a"
                  onChange={(v) => mudar('secondaryColor', v)}
                />
                <div className="campo">
                  <label htmlFor="e-nota">Nota considerada ruim (1 a 10)</label>
                  <input
                    ref={notaRef}
                    id="e-nota"
                    inputMode="numeric"
                    aria-invalid={tentou && erros.threshold}
                    aria-describedby={descr('e-nota', true, true)}
                    value={form.threshold}
                    onChange={(e) => mudar('threshold', e.target.value)}
                  />
                  <p className="campo__dica" id="e-nota-dica">
                    Notas até {badScoreThreshold} abrem reclamação na pesquisa pública e podem criar caso automaticamente.
                  </p>
                  <p className="campo__erro" id="e-nota-erro" hidden={!(tentou && erros.threshold)}>
                    Use um número inteiro de 1 a 10.
                  </p>
                </div>
              </div>
            </div>

            <div className="cfg__salvar">
              <p className="cfg__salvar-status" role="status">
                {status}
              </p>
              {alterado && (
                <button
                  className="btn btn--fantasma"
                  type="button"
                  disabled={updateTenant.isPending}
                  onClick={() => {
                    if (inicial) setForm(inicial);
                    setAlterado(false);
                    setTentou(false);
                    setStatus('Alterações descartadas');
                  }}
                >
                  Descartar alterações
                </button>
              )}
              <button className="btn btn--primario" type="submit" disabled={updateTenant.isPending}>
                {updateTenant.isPending ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        )}
      </div>
      {aviso}
    </ConfigLayout>
  );
}

function CampoCor(props: { id: string; rotulo: string; valor: string; padrao: string; onChange: (v: string) => void }) {
  const { id, rotulo, valor, padrao, onChange } = props;
  const valorSeletor = valor.trim() && corValida(valor.trim()) ? valor.trim() : padrao;
  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo} <span className="opcional">(opcional)</span>
      </label>
      <div className="cfg-cor">
        <input
          type="color"
          className="cfg-cor__seletor"
          aria-label={`${rotulo}: escolher no seletor`}
          value={valorSeletor}
          onChange={(e) => onChange(e.target.value)}
        />
        <input id={id} value={valor} placeholder={`${padrao} (opcional)`} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
