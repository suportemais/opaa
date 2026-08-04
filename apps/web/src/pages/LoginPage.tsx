import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { setAccessToken, setTenantId } from '../lib/auth-store';

export function LoginPage() {
  const navigate = useNavigate();
  const [tenantId, setTenantIdInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ accessToken: string; tenantId: string; userId: string }>('/auth/login', {
        method: 'POST',
        json: { tenantId, email, password },
      });
      setAccessToken(result.accessToken);
      setTenantId(result.tenantId);
      navigate('/app');
    } catch (err) {
      setError('Não foi possível autenticar. Verifique tenant, e-mail e senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-sky-600" />
          <div className="text-lg font-semibold text-slate-900">Entrar</div>
          <div className="text-sm text-slate-600">Acesse o painel do seu tenant</div>
        </div>

        <Card>
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Tenant ID</div>
              <Input value={tenantId} onChange={(e) => setTenantIdInput(e.target.value)} placeholder="UUID do tenant" />
            </div>
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

