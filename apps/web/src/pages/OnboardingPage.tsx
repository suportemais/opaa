import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type Result = { tenantId: string; adminUserId: string; unitId: string };

export function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const [legalName, setLegalName] = useState('Minha Empresa LTDA');
  const [tradeName, setTradeName] = useState('Minha Marca');
  const [email, setEmail] = useState('contato@empresa.com');
  const [phone, setPhone] = useState('');
  const [segment, setSegment] = useState('restaurante');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#0ea5e9');

  const [adminName, setAdminName] = useState('Administrador');
  const [adminEmail, setAdminEmail] = useState('admin@empresa.com');
  const [adminPassword, setAdminPassword] = useState('Admin1234!');
  const [unitName, setUnitName] = useState('Unidade 1');
  const [unitTimeZone, setUnitTimeZone] = useState('America/Sao_Paulo');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const created = await apiFetch<Result>('/onboarding/tenant', {
        method: 'POST',
        json: {
          legalName,
          tradeName,
          email,
          phone: phone || undefined,
          segment: segment || undefined,
          primaryColor,
          secondaryColor,
          adminName,
          adminEmail,
          adminPassword,
          unitName,
          unitTimeZone,
        },
      });
      setResult(created);
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          typeof err.body === 'object' && err.body && 'message' in err.body
            ? String((err.body as any).message)
            : typeof err.body === 'string'
              ? err.body
              : 'Falha na API';
        setError(`Não foi possível concluir o onboarding (${err.status}). ${msg}`);
      } else {
        setError('Não foi possível concluir o onboarding. Verifique se a API está no ar e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">Onboarding</div>
            <div className="text-sm text-slate-600">Crie seu tenant e o primeiro administrador</div>
          </div>
          <Link to="/login" className="text-sm text-slate-600 hover:underline">
            Já tenho conta
          </Link>
        </div>

        {result ? (
          <Card title="Tenant criado" description="Use o Tenant ID para entrar.">
            <div className="grid gap-2 text-sm">
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-slate-500">Tenant ID</div>
                <div className="font-mono text-slate-900">{result.tenantId}</div>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-slate-500">Admin</div>
                <div className="text-slate-900">{adminEmail}</div>
              </div>
              <div className="pt-2">
                <Button onClick={() => navigate('/login')}>Ir para login</Button>
              </div>
            </div>
          </Card>
        ) : (
          <form className="grid gap-6" onSubmit={onSubmit}>
            <Card title="Empresa" description="Dados principais do tenant">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="mb-1 text-sm font-medium text-slate-700">Razão social</div>
                  <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <div className="mb-1 text-sm font-medium text-slate-700">Nome fantasia</div>
                  <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">E-mail</div>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">Telefone</div>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">Segmento</div>
                  <Input value={segment} onChange={(e) => setSegment(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 text-sm font-medium text-slate-700">Cor primária</div>
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                  </div>
                  <div>
                    <div className="mb-1 text-sm font-medium text-slate-700">Cor secundária</div>
                    <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Administrador" description="Usuário principal do tenant">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
                  <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">E-mail</div>
                  <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <div className="mb-1 text-sm font-medium text-slate-700">Senha</div>
                  <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card title="Primeira unidade" description="Base para permissões e relatórios">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
                  <Input value={unitName} onChange={(e) => setUnitName(e.target.value)} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium text-slate-700">Fuso horário</div>
                  <Input value={unitTimeZone} onChange={(e) => setUnitTimeZone(e.target.value)} />
                </div>
              </div>
            </Card>

            {error && <div className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate('/login')}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Criando...' : 'Criar tenant'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
