import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatPriceLabel, normalizeFeatures } from '../../lib/public-plans';

type AdminPlan = {
  id: string;
  name: string;
  slug: string;
  amountCents: number;
  badge: string | null;
  shortDescription: string | null;
  ctaLabel: string;
  features: unknown;
  isPublic: boolean;
  featured: boolean;
  displayOrder: number;
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
      apiFetch<AdminPlan>(`/admin/plans/${props.plan.id}`, {
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
    },
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <div className="text-base font-semibold text-slate-900">{props.plan.name}</div>
        <div className="text-sm text-slate-500">slug: {props.plan.slug}</div>
      </div>
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
            className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
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
        {save.isError && (
          <div className="md:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Falha ao salvar. Tente novamente.
          </div>
        )}
        {save.isSuccess && (
          <div className="md:col-span-2 rounded-md bg-cyan-50 px-3 py-2 text-sm text-cyan-800">Plano atualizado.</div>
        )}
        <div className="md:col-span-2">
          <Button type="submit" disabled={save.isPending} className="bg-cyan-600 hover:bg-cyan-700">
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function AdminPlansPage() {
  const plans = useQuery({
    queryKey: ['adminPlans'],
    queryFn: () => apiFetch<AdminPlan[]>('/admin/plans'),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Planos</h1>
        <p className="text-sm text-slate-600">
          Catálogo Start / Pro / Redes. Apenas upsert — não há botão nem API de exclusão.
        </p>
      </div>
      {plans.isLoading && <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />}
      {plans.isError && (
        <AdminEmptyState
          title="Não foi possível carregar os planos"
          description="Sem permissão de plataforma ou falha na API. Tente novamente."
          onRetry={() => void plans.refetch()}
        />
      )}
      {plans.data?.length === 0 && (
        <AdminEmptyState
          title="Nenhum plano cadastrado"
          description="Rode o upsert de seed-plans (start / pro / redes). Nada é apagado."
        />
      )}
      {plans.data?.map((plan) => (
        <PlanEditor key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
