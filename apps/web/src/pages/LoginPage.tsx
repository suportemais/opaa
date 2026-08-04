import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { ApiError } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { setAccessToken, setTenantId } from '../lib/auth-store';

type TenantOption = { tenantId: string; tradeName?: string | null; legalName?: string | null };

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantOptions, setTenantOptions] = useState<TenantOption[] | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
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
    <div className="flex h-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/favicon.svg" alt="OPAA" className="mx-auto mb-3 h-10 w-10" />
          <div className="text-lg font-semibold text-slate-900">Entrar</div>
          <div className="text-sm text-slate-600">Acesse o painel</div>
        </div>

        <Card>
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
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
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="pt-1 text-center text-sm text-slate-600">
              Novo por aqui? <Link to="/onboarding" className="text-sky-700 hover:underline">Criar tenant</Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
