import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiFetch } from '../lib/api';
import { randomId } from '../lib/id';

type PublicFormTenant = {
  id: string;
  slug: string;
  tradeName: string;
  legalName: string;
};

type PublicFormUnit = {
  id: string;
  name: string;
  internalCode: string | null;
};

type PublicFormData = {
  tenant: PublicFormTenant;
  units: PublicFormUnit[];
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

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'moral_harassment', label: 'Assédio moral' },
  { value: 'sexual_harassment', label: 'Assédio sexual' },
  { value: 'discrimination', label: 'Discriminação' },
  { value: 'racism', label: 'Racismo' },
  { value: 'racial_injury', label: 'Injúria racial' },
  { value: 'homophobia', label: 'Homofobia' },
  { value: 'transphobia', label: 'Transfobia' },
  { value: 'religious_intolerance', label: 'Intolerância religiosa' },
  { value: 'fraud', label: 'Fraude' },
  { value: 'corruption', label: 'Corrupção' },
  { value: 'conflict_of_interest', label: 'Conflito de interesses' },
  { value: 'policy_violation', label: 'Violação de políticas internas' },
  { value: 'work_safety', label: 'Segurança do trabalho' },
  { value: 'lgpd_privacy', label: 'LGPD / privacidade' },
  { value: 'misconduct', label: 'Conduta inadequada' },
  { value: 'other', label: 'Outro (descreva)' },
];

export function PublicWhistleblowerPage() {
  const params = useParams();
  const tenantSlug = params.tenantSlug ?? '';

  const form = useQuery({
    queryKey: ['publicWhistleblowerForm', tenantSlug],
    queryFn: () => apiFetch<PublicFormData>(`/public/whistleblower/${tenantSlug}`),
    enabled: Boolean(tenantSlug),
    retry: false,
  });

  const [category, setCategory] = useState<string>('');
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

  const [confirmOpen, setConfirmOpen] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      const dto = {
        idempotencyKey: randomId(24),
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

  const requiredErrors = useMemo(() => {
    const errs: string[] = [];
    if (!category) errs.push('Selecione a categoria.');
    if (category === 'other' && !customCategory.trim()) errs.push('Descreva a categoria "Outro".');
    if (!title.trim()) errs.push('Informe o título/assunto.');
    if (!description.trim()) errs.push('Descreva o ocorrido.');
    if (occurredAt) {
      const d = new Date(occurredAt);
      if (Number.isNaN(d.getTime())) errs.push('Data do ocorrido inválida.');
    }
    if (!truthfulnessAgreement) errs.push('Marque a declaração de veracidade das informações.');
    return errs;
  }, [category, customCategory, title, description, occurredAt, truthfulnessAgreement]);

  if (form.isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">
        Carregando...
      </div>
    );
  }

  if (form.isError || !form.data) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-sm text-rose-700">
        Canal de denúncias não encontrado ou indisponível.
      </div>
    );
  }

  if (submit.data) {
    const r = submit.data;
    return (
      <div className="min-h-full bg-slate-50 p-4 md:p-10">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-44">
          <div className="text-center">
            <img
              src="/logo-opiina.png"
              alt="Opiina"
              className="mx-auto mb-4 h-20 drop-shadow-sm md:h-28"
              onError={(e) => {
                const el = e.currentTarget;
                if (el.src.endsWith('/logo.svg')) return;
                el.src = '/logo.svg';
              }}
            />
            <div className="text-xl font-semibold text-slate-900">Canal de denúncias — {form.data.tenant.tradeName}</div>
            <div className="text-sm text-slate-600">Obrigado por contribuir com a integridade e segurança da empresa.</div>
          </div>

          <Card title="Denúncia recebida" description={r.message}>
            <div className="grid gap-3 text-sm">
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Protocolo</div>
                <div className="font-mono text-lg font-semibold text-slate-900">{r.protocol}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Identificação</div>
                <div className="text-slate-800">{r.anonymous ? 'Anônimo' : 'Identificado voluntariamente'}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Recebida em</div>
                <div className="text-slate-800">{new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                Guarde este número de protocolo em local seguro. Ele serve para consultas futuras e acompanhamento junto ao comitê de ética.
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const requiredMissing = requiredErrors.length > 0;

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-44">
        <div className="text-center">
          <img
            src="/logo-opiina.png"
            alt="Opiina"
            className="mx-auto mb-4 h-20 drop-shadow-sm md:h-28"
            onError={(e) => {
              const el = e.currentTarget;
              if (el.src.endsWith('/logo.svg')) return;
              el.src = '/logo.svg';
            }}
          />
          <div className="text-xl font-semibold text-slate-900">Canal de denúncias — {form.data.tenant.tradeName}</div>
          <div className="text-sm text-slate-600">
            Preencha os campos abaixo. Sua denúncia é confidencial e tratada pelo comitê de ética.
          </div>
        </div>

        <Card title="Aviso de confidencialidade e conformidade LGPD" description="Leia atentamente antes de enviar sua denúncia">
          <div className="grid gap-3 text-sm leading-relaxed text-slate-700">
            <p>
              Este canal destina-se ao recebimento de denúncias relacionadas a racismo, injúria racial, homofobia, transfobia, intolerância religiosa, assédio de qualquer natureza, violência e demais formas de discriminação ou condutas inadequadas ocorridas no ambiente de trabalho.
            </p>
            <p>
              As informações fornecidas serão tratadas com confidencialidade e utilizadas exclusivamente para a apuração dos fatos relatados, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD). O acesso aos dados será restrito às pessoas autorizadas e, quando necessário, as informações poderão ser compartilhadas para fins de investigação e cumprimento de obrigações legais e regulatórias.
            </p>
            <p>
              O denunciante poderá optar por permanecer anônimo, sendo asseguradas a confidencialidade das informações e a não retaliação contra pessoas que apresentem denúncias fundamentadas.
            </p>
          </div>
        </Card>

        {!anonymous && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            Você optou por se identificar voluntariamente. Seus dados serão utilizados apenas para contato sobre esta denúncia.
          </div>
        )}

        <Card>
          <div className="grid gap-5">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-800">Categoria da denúncia *</div>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Selecione...</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {category === 'other' && (
                <div className="mt-2">
                  <Input
                    placeholder="Descreva a categoria (ex: assédio moral virtual etc.)"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-800">Título / Assunto *</div>
              <Input placeholder="Resuma o ocorrido em poucas palavras" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-slate-800">Descrição detalhada do ocorrido *</div>
              <textarea
                className="min-h-40 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                placeholder="Conte de forma clara e objetiva o que aconteceu, com datas, locais e contexto que você considera importantes."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-sm font-medium text-slate-800">Data aproximada do ocorrido</div>
                <Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium text-slate-800">Unidade (opcional)</div>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  <option value="">Selecione (opcional)</option>
                  {form.data.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.internalCode ? ` (${u.internalCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-sm font-medium text-slate-800">Local / Endereço (opcional)</div>
                <Input placeholder="Se preferir, descreva o local em texto livre" value={locationText} onChange={(e) => setLocationText(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-sm font-medium text-slate-800">Pessoas envolvidas (opcional)</div>
                <textarea
                  className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="Nomes, cargos, vínculos ou qualquer informação relevante das pessoas diretamente envolvidas."
                  value={involvedPeople}
                  onChange={(e) => setInvolvedPeople(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-sm font-medium text-slate-800">Testemunhas (opcional)</div>
                <textarea
                  className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="Se houver, liste ou descreva testemunhas e seus contatos se você tiver."
                  value={witnesses}
                  onChange={(e) => setWitnesses(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-sm font-medium text-slate-800">Informações adicionais (opcional)</div>
                <textarea
                  className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="Qualquer outro contexto, prova, links, ou observações úteis para a apuração."
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Identificação (opcional)</div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                  />
                  <span>Quero permanecer anônimo</span>
                </label>
              </div>
              <div className="mb-2 text-xs text-slate-600">
                Nunca pediremos login/senha para enviar denúncia. Se você optar por se identificar voluntariamente, preencha ao menos um dos campos abaixo.
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Nome</div>
                  <Input
                    disabled={anonymous}
                    placeholder="Nome completo"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">E-mail</div>
                  <Input
                    disabled={anonymous}
                    placeholder="voce@email.com"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Telefone</div>
                  <Input
                    disabled={anonymous}
                    placeholder="(11) 90000-0000"
                    value={reporterPhone}
                    onChange={(e) => setReporterPhone(e.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">Documento (CPF / matrícula etc.)</div>
                  <Input
                    disabled={anonymous}
                    placeholder="Opcional"
                    value={reporterDoc}
                    onChange={(e) => setReporterDoc(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0"
                  checked={truthfulnessAgreement}
                  onChange={(e) => setTruthfulnessAgreement(e.target.checked)}
                />
                <span className="text-sm leading-relaxed text-slate-800">
                  Declaro, sob minha responsabilidade, que as informações prestadas são verdadeiras, conforme meu conhecimento, e foram fornecidas de boa-fé e de forma legítima.
                </span>
              </label>
            </div>

            {requiredMissing && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <div className="mb-1 text-sm font-semibold">Antes de enviar, por favor:</div>
                <ul className="list-disc pl-5 text-sm">
                  {requiredErrors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmOpen(true)}
                disabled={requiredMissing || submit.isPending}
              >
                {submit.isPending ? 'Enviando...' : 'Enviar denúncia'}
              </Button>
            </div>
          </div>
        </Card>

        <div className="text-center text-xs text-slate-500">
          Desenvolvido por{' '}
          <a className="text-sky-700 hover:underline" href="https://devmais.com" target="_blank" rel="noreferrer">
            Dev+
          </a>
        </div>

        {confirmOpen && (
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/40 p-4 md:items-center">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
              <div className="text-lg font-semibold text-slate-900">Confirmar envio?</div>
              <div className="mt-1 text-sm text-slate-600">
                Após enviar, você receberá um número de protocolo para acompanhamento.
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submit.isPending}>
                  Voltar
                </Button>
                <Button
                  onClick={() => {
                    setConfirmOpen(false);
                    submit.mutate();
                  }}
                  disabled={submit.isPending}
                >
                  {submit.isPending ? 'Enviando...' : 'Sim, enviar agora'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {submit.isError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Falha ao enviar denúncia. Confira os campos obrigatórios e tente novamente.
          </div>
        )}
      </div>
    </div>
  );
}
