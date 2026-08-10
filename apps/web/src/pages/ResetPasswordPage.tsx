import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const hint = useMemo(() => {
    if (!password) return null;
    if (password.length < 8) return { ok: false, msg: 'Senha deve ter pelo menos 8 caracteres.' };
    if (password !== confirmPassword) return { ok: false, msg: 'As senhas não coincidem.' };
    return { ok: true, msg: 'Senha forte.' };
  }, [password, confirmPassword]);

  const reset = useMutation({
    mutationFn: () => apiFetch<{ ok: true }>('/auth/reset', { method: 'POST', json: { token, password } }),
  });

  useEffect(() => {
    if (reset.isSuccess) {
      const t = setTimeout(() => navigate('/login'), 2500);
      return () => clearTimeout(t);
    }
  }, [reset.isSuccess, navigate]);

  if (!token) {
    return (
      <PublicLayout>
        <Card>
          <div className="mb-1 text-2xl font-semibold text-slate-900">Link inválido</div>
          <div className="text-sm text-slate-600">
            O link de redefinição é inválido. Solicite um novo link de recuperação de senha.
          </div>
          <div className="mt-6">
            <Link to="/forgot-password" className="text-sm text-sky-700 hover:underline">
              ← Solicitar novo link
            </Link>
          </div>
        </Card>
      </PublicLayout>
    );
  }

  if (reset.isSuccess) {
    return (
      <PublicLayout>
        <Card>
          <div className="mb-1 text-2xl font-semibold text-slate-900">Senha atualizada ✅</div>
          <div className="text-sm text-slate-600">
            Sua nova senha foi definida com sucesso. Agora você já pode entrar usando ela.
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <Link to="/login" className="text-sm text-sky-700 hover:underline">
              ← Voltar para o login
            </Link>
            <Button onClick={() => navigate('/login')}>Fazer login</Button>
          </div>
        </Card>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <Card>
        <div className="mb-1 text-2xl font-semibold text-slate-900">Criar nova senha</div>
        <div className="mb-4 text-sm text-slate-600">
          Escolha uma senha forte com pelo menos 8 caracteres.
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (hint?.ok) reset.mutate();
          }}
        >
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Nova senha</div>
            <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Confirmar nova senha</div>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
          </div>

          {hint && (
            <div className={`rounded-md px-3 py-2 text-sm ${hint.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
              {hint.msg}
            </div>
          )}

          {reset.isError && (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {(reset.error instanceof ApiError)
                ? friendlyError((reset.error.status), ((reset.error.body as any)?.message as string | undefined))
                : 'Não foi possível atualizar sua senha.'}
            </div>
          )}

          <Button type="submit" disabled={reset.isPending || !hint?.ok}>
            {reset.isPending ? 'Atualizando...' : 'Atualizar senha'}
          </Button>

          <div className="pt-1 text-center text-sm text-slate-600">
            Desistiu? <Link to="/login" className="text-sky-700 hover:underline">Voltar para login</Link>
          </div>
        </form>
      </Card>
    </PublicLayout>
  );
}

function friendlyError(status: number, message?: string) {
  const code = typeof message === 'string' ? message : '';
  if (status === 404 || code === 'token_not_found') return 'Link inválido ou já utilizado. Solicite um novo link.';
  if (code === 'token_expired') return 'Link expirado. Validade é de 1 hora — solicite um novo link.';
  if (code === 'token_used') return 'Link já utilizado. Solicite um novo link para redefinir a senha.';
  if (code === 'user_inactive') return 'Conta desativada. Entre em contato com o administrador.';
  if (code === 'password_too_short') return 'Senha muito curta. Use pelo menos 8 caracteres.';
  return 'Não foi possível atualizar sua senha. Tente novamente mais tarde.';
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-sky-50" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="relative mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-6 p-6">
        <Link to="/" className="inline-flex">
          <img
            src="/logo-opiina.png"
            alt="Opiina"
            className="h-20 drop-shadow"
            onError={(e) => {
              const el = e.currentTarget;
              if (el.src.endsWith('/logo.svg')) return;
              el.src = '/logo.svg';
            }}
          />
        </Link>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
