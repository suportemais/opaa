import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

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

export function CompanyPage() {
  const qc = useQueryClient();
  const segmentPresets = useMemo(
    () => [
      'Restaurante',
      'Clínica',
      'Odontologia',
      'Academia',
      'Estética',
      'Oficina',
      'Varejo',
      'Hotelaria',
      'Educação',
      'Serviços',
    ],
    [],
  );

  const tenant = useQuery({
    queryKey: ['tenantMe'],
    queryFn: () => apiFetch<TenantMe>('/tenant/me'),
  });

  const badScoreThreshold = useMemo(() => {
    const v = tenant.data?.settings?.badScoreThreshold;
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 6;
  }, [tenant.data]);

  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [segment, setSegment] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [thresholdText, setThresholdText] = useState('6');

  useEffect(() => {
    if (!tenant.data) return;
    setLegalName(tenant.data.legalName ?? '');
    setTradeName(tenant.data.tradeName ?? '');
    setDocument(tenant.data.document ?? '');
    setEmail(tenant.data.email ?? '');
    setPhone(tenant.data.phone ?? '');
    setSegment(tenant.data.segment ?? '');
    setPrimaryColor(tenant.data.primaryColor ?? '');
    setSecondaryColor(tenant.data.secondaryColor ?? '');
    setThresholdText(String(badScoreThreshold));
  }, [tenant.data, badScoreThreshold]);

  const updateTenant = useMutation({
    mutationFn: async () => {
      const threshold = Number(thresholdText);
      return apiFetch<TenantMe>('/tenant/me', {
        method: 'PATCH',
        json: {
          legalName: legalName.trim() || undefined,
          tradeName: tradeName.trim() || undefined,
          document: document.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          segment: segment.trim() || undefined,
          primaryColor: primaryColor.trim() || undefined,
          secondaryColor: secondaryColor.trim() || undefined,
          badScoreThreshold: Number.isFinite(threshold) ? threshold : undefined,
        },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tenantMe'] });
      await qc.invalidateQueries({ queryKey: ['surveys'] });
    },
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const changePassword = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>('/auth/change-password', {
        method: 'POST',
        json: { currentPassword, newPassword },
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
    },
  });

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Empresa</div>
        <div className="text-sm text-slate-600">Cadastro do tenant, configurações e segurança</div>
      </div>

      <Card title="Cadastro do tenant">
        {tenant.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {tenant.isError && <div className="text-sm text-rose-700">Falha ao carregar dados da empresa</div>}
        {tenant.data && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="mb-1 text-sm font-medium text-slate-700">Subdomínio</div>
              <Input value={tenant.data.slug} disabled />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Nome fantasia</div>
              <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Razão social</div>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Documento</div>
              <Input value={document} onChange={(e) => setDocument(e.target.value)} placeholder="CNPJ/CPF (opcional)" />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Segmento</div>
              <Input
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Segmento (opcional)"
                list="opaa_segments"
              />
              <datalist id="opaa_segments">
                {segmentPresets.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">E-mail</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="E-mail (opcional)" />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Telefone</div>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Telefone (opcional)" />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Cor primária</div>
              <div className="flex items-center gap-3">
                <input
                  className="h-10 w-12 rounded-md border border-slate-200 bg-white p-1"
                  type="color"
                  value={primaryColor && primaryColor.trim() ? primaryColor : '#0ea5e9'}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#0ea5e9 (opcional)" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Cor secundária</div>
              <div className="flex items-center gap-3">
                <input
                  className="h-10 w-12 rounded-md border border-slate-200 bg-white p-1"
                  type="color"
                  value={secondaryColor && secondaryColor.trim() ? secondaryColor : '#0f172a'}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="#0f172a (opcional)" />
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="mb-1 text-sm font-medium text-slate-700">Nota considerada ruim (1..10)</div>
              <Input value={thresholdText} onChange={(e) => setThresholdText(e.target.value)} inputMode="numeric" />
              <div className="mt-1 text-xs text-slate-500">
                Notas ≤ {badScoreThreshold} abrem reclamação na pesquisa pública e podem criar caso automaticamente.
              </div>
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                disabled={updateTenant.isPending}
                onClick={() => {
                  if (!tenant.data) return;
                  setLegalName(tenant.data.legalName ?? '');
                  setTradeName(tenant.data.tradeName ?? '');
                  setDocument(tenant.data.document ?? '');
                  setEmail(tenant.data.email ?? '');
                  setPhone(tenant.data.phone ?? '');
                  setSegment(tenant.data.segment ?? '');
                  setPrimaryColor(tenant.data.primaryColor ?? '');
                  setSecondaryColor(tenant.data.secondaryColor ?? '');
                  setThresholdText(String(badScoreThreshold));
                }}
              >
                Resetar
              </Button>
              <Button disabled={updateTenant.isPending} onClick={() => updateTenant.mutate()}>
                {updateTenant.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
            {updateTenant.isError && (
              <div className="md:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Falha ao salvar. Verifique permissões e tente novamente.
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Segurança" description="Troque sua senha">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Senha atual</div>
            <Input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Nova senha</div>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Confirmar nova senha</div>
            <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" />
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <Button
              disabled={changePassword.isPending}
              onClick={() => {
                if (newPassword.trim().length < 8) {
                  setPasswordError('A nova senha precisa ter pelo menos 8 caracteres.');
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setPasswordError('A confirmação da senha não confere.');
                  return;
                }
                setPasswordError(null);
                changePassword.mutate(undefined, {
                  onError: () => setPasswordError('Falha ao alterar senha. Verifique a senha atual.'),
                });
              }}
            >
              {changePassword.isPending ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </div>
          {(passwordError || changePassword.isSuccess) && (
            <div
              className={[
                'md:col-span-2 rounded-md px-3 py-2 text-sm',
                passwordError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700',
              ].join(' ')}
            >
              {passwordError ?? 'Senha alterada com sucesso.'}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
