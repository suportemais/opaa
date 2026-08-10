import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');

  const send = useMutation({
    mutationFn: () => apiFetch<{ ok: true; sent: number }>('/auth/forgot', { method: 'POST', json: { email } }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send.mutate();
  };

  if (send.isSuccess) {
    return (
      <PublicLayout>
        <Card>
          <div className="mb-1 text-2xl font-semibold text-slate-900">Verifique seu e-mail</div>
          <div className="text-sm leading-relaxed text-slate-600">
            Se o e-mail informado possuir uma conta ativa, enviaremos um link para redefinir a senha. O link é válido
            por 1 hora.
          </div>
          <div className="mt-6 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Dica: se não encontrar a mensagem, verifique a caixa de spam ou “Promoções”.
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <Link to="/login" className="text-sm text-sky-700 hover:underline">
              ← Voltar para o login
            </Link>
            <Button variant="secondary" onClick={() => { send.reset(); setEmail(''); }}>
              Tentar outro e-mail
            </Button>
          </div>
        </Card>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <Card>
        <div className="mb-1 text-2xl font-semibold text-slate-900">Esqueci minha senha</div>
        <div className="mb-4 text-sm text-slate-600">
          Informe o e-mail da sua conta para receber o link de redefinição.
        </div>

        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">E-mail</div>
            <Input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com"
            />
          </div>

          {send.isError && (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {(send.error instanceof ApiError)
                ? (send.error.body as any)?.message ?? 'Não foi possível processar a solicitação.'
                : 'Não foi possível processar a solicitação.'}
            </div>
          )}

          <Button type="submit" disabled={send.isPending || !/^\S+@\S+\.\S+$/.test(email)}>
            {send.isPending ? 'Enviando...' : 'Enviar link de redefinição'}
          </Button>

          <div className="pt-1 text-center text-sm text-slate-600">
            Lembreu a senha? <Link to="/login" className="text-sky-700 hover:underline">Entrar</Link>
          </div>
        </form>
      </Card>
    </PublicLayout>
  );
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
