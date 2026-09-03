import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { formatPriceLabel, normalizeFeatures, type PublicPlan } from '../lib/public-plans';

type AdminPlan = PublicPlan & {
  id: string;
  description: string | null;
  isPublic: boolean;
  isActive: boolean;
  stripePriceId: string | null;
};

function featuresToText(plan: AdminPlan) {
  return normalizeFeatures(plan.features)
    .map((feature) => feature.label)
    .join('\n');
}

function PlanEditor(props: { plan: AdminPlan }) {
  const qc = useQueryClient();
  const [amountCents, setAmountCents] = useState(String(props.plan.amountCents));
  const [badge, setBadge] = useState(props.plan.badge ?? '');
  const [shortDescription, setShortDescription] = useState(props.plan.shortDescription ?? '');
  const [ctaLabel, setCtaLabel] = useState(props.plan.ctaLabel ?? 'Assinar');
  const [featuresText, setFeaturesText] = useState(featuresToText(props.plan));
  const [isPublic, setIsPublic] = useState(props.plan.isPublic);
  const [featured, setFeatured] = useState(props.plan.featured);
  const [displayOrder, setDisplayOrder] = useState(String(props.plan.displayOrder));
  const [stripePriceId, setStripePriceId] = useState(props.plan.stripePriceId ?? '');

  useEffect(() => {
    setAmountCents(String(props.plan.amountCents));
    setBadge(props.plan.badge ?? '');
    setShortDescription(props.plan.shortDescription ?? '');
    setCtaLabel(props.plan.ctaLabel ?? 'Assinar');
    setFeaturesText(featuresToText(props.plan));
    setIsPublic(props.plan.isPublic);
    setFeatured(props.plan.featured);
    setDisplayOrder(String(props.plan.displayOrder));
    setStripePriceId(props.plan.stripePriceId ?? '');
  }, [props.plan]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<AdminPlan>(`/plans/${props.plan.id}`, {
        method: 'PATCH',
        json: {
          amountCents: Number(amountCents),
          badge: badge.trim() || null,
          shortDescription: shortDescription.trim() || null,
          ctaLabel: ctaLabel.trim() || 'Assinar',
          features: featuresText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          isPublic,
          featured,
          displayOrder: Number(displayOrder),
          stripePriceId: stripePriceId.trim() || null,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['adminPlans'] });
      void qc.invalidateQueries({ queryKey: ['publicPlans'] });
    },
  });

  return (
    <Card title={props.plan.name} description={`slug: ${props.plan.slug}`}>
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Preço (centavos)</div>
          <Input value={amountCents} onChange={(e) => setAmountCents(e.target.value)} />
          <div className="mt-1 text-xs text-slate-500">{formatPriceLabel(Number(amountCents) || 0)}</div>
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Ordem</div>
          <Input value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Badge</div>
          <Input value={badge} onChange={(e) => setBadge(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">CTA</div>
          <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-sm font-medium text-slate-700">Resumo</div>
          <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-sm font-medium text-slate-700">Features (uma por linha)</div>
          <textarea
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-sm font-medium text-slate-700">Stripe Price ID</div>
          <Input value={stripePriceId} onChange={(e) => setStripePriceId(e.target.value)} placeholder="opcional" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Público na vitrine
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Destacar (Mais popular)
        </label>
        {save.isError && <div className="md:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Falha ao salvar.</div>}
        {save.isSuccess && <div className="md:col-span-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Plano atualizado.</div>}
        <div className="md:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function PlansAdminPage() {
  const plans = useQuery({
    queryKey: ['adminPlans'],
    queryFn: () => apiFetch<AdminPlan[]>('/plans/admin'),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-lg font-semibold text-slate-900">Planos</div>
        <div className="text-sm text-slate-600">
          Catálogo da vitrine pública. Apenas atualização — nenhum plano é apagado.
        </div>
      </div>
      {plans.isLoading && <div className="text-sm text-slate-600">Carregando planos...</div>}
      {plans.isError && (
        <div className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Sem permissão de plataforma ou falha ao carregar. Em produção, o caminho principal é o upsert por slug.
        </div>
      )}
      {plans.data?.map((plan) => (
        <PlanEditor key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
