import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import { env } from '../lib/env';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { setAccessToken, setTenantId } from '../lib/auth-store';

type TenantOption = { tenantId: string; tenantSlug?: string | null; tradeName?: string | null; legalName?: string | null };

export function LoginPage() {
  const navigate = useNavigate();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const baseDomain = env.appBaseDomain;
  const isRootDomain = !!baseDomain && hostname === baseDomain;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantOptions, setTenantOptions] = useState<TenantOption[] | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRootDomain) {
        const slug = company.trim().toLowerCase();
        if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
          setError('Informe o subdomínio da empresa (ex.: minha-empresa).');
          return;
        }
        const protocol = window.location.protocol || 'https:';
        window.location.href = `${protocol}//${slug}.${baseDomain}/login`;
        return;
      }

      const result = await apiFetch<{ accessToken: string; tenantId: string; userId: string }>('/auth/login', {
        method: 'POST',
        json:
          tenantOptions && selectedTenantId
            ? { tenantId: selectedTenantId, email, password }
            : { email, password },
      });
      setAccessToken(result.accessToken);
      setTenantId(result.tenantId);
      navigate('/app');
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as any;
        const message = body?.message ?? body;
        if (err.status === 409 && message?.code === 'multiple_tenants' && Array.isArray(message?.tenants)) {
          setTenantOptions(message.tenants);
          setSelectedTenantId(message.tenants?.[0]?.tenantId ?? '');
          setError('Selecione a empresa para continuar.');
          return;
        }
      }
      setError('Não foi possível autenticar. Verifique e-mail e senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-sky-50" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-full w-full max-w-6xl items-center gap-10 p-6">
        <div className="hidden flex-1 flex-col gap-5 md:flex">
          <Link to="/" className="inline-flex items-center gap-3">
            <img
              src="/logo-opiina.png"
              alt="Opiina"
              className="h-28 drop-shadow"
              onError={(e) => {
                const el = e.currentTarget;
                if (el.src.endsWith('/logo.svg')) return;
                el.src = '/logo.svg';
              }}
            />
          </Link>

          <div className="mt-6 text-3xl font-semibold leading-tight text-slate-900">
            Transforme feedback em crescimento
          </div>
          <div className="text-sm leading-relaxed text-slate-600">
            Capture NPS, identifique oportunidades e organize o atendimento em um fluxo operacional simples.
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <div className="rounded-lg border border-slate-200 bg-white/60 px-4 py-3">Pesquisa rápida (wizard) e multicanal</div>
            <div className="rounded-lg border border-slate-200 bg-white/60 px-4 py-3">Dashboard e métricas por unidade</div>
            <div className="rounded-lg border border-slate-200 bg-white/60 px-4 py-3">CRM e gestão de ocorrências (Kanban)</div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
              <img
                src="/icon-opiina.png"
                alt="Opiina"
                className="h-full w-full drop-shadow-md"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el.src.endsWith('/favicon.svg')) return;
                  el.src = '/favicon.svg';
                }}
              />
            </div>
            <img
              src="/logo-opiina.png"
              alt="Opiina"
              className="mb-2 h-16 drop-shadow-sm"
              onError={(e) => {
                const el = e.currentTarget;
                if (el.src.endsWith('/logo.svg')) return;
                el.src = '/logo.svg';
              }}
            />
            <div className="mt-1 text-base font-semibold text-slate-900">Entrar</div>
            <div className="text-sm text-slate-600">Acesse o painel</div>
          </div>

          <Card>
            <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            {isRootDomain ? (
              <div>
                <div className="mb-1 text-sm font-medium text-slate-700">Empresa</div>
                <div className="flex gap-2">
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="minha-empresa" />
                  <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                    .{baseDomain}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {tenantOptions && (
                  <div>
                    <div className="mb-1 text-sm font-medium text-slate-700">Empresa</div>
                    <select
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    >
                      {tenantOptions.map((t) => (
                        <option key={t.tenantId} value={t.tenantId}>
                          {t.tradeName ?? t.legalName ?? t.tenantId}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">E-mail</div>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">Senha</div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </>
            )}

            {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="pt-1 text-center text-sm text-slate-600">
              Novo por aqui? <Link to="/onboarding" className="text-sky-700 hover:underline">Criar tenant</Link>
            </div>
          </form>
          </Card>
          <div className="mt-6 text-center text-xs text-slate-500">
            Desenvolvido por{' '}
            <a className="text-sky-700 hover:underline" href="https://devmais.com" target="_blank" rel="noreferrer">
              Dev+
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
