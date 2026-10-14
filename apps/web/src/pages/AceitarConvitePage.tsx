import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { env } from '../lib/env';
import type { AcceptInviteRequest, AcceptInviteResponse } from '../lib/api-novos';
import { CreditoDev, Marca, Selo, SpriteBrilho } from '../components/site/SiteBits';
import { codigoDoErro } from '../components/painel/config/erros';

const ERROS_CONVITE: Record<string, string> = {
  invite_expired: 'Este convite expirou. Peça a quem convidou você para reenviar o convite.',
  invite_used: 'Este convite já foi usado. Se você já criou sua senha, é só entrar.',
  invite_revoked: 'Este convite foi substituído por um mais novo. Abra o link do último e-mail que você recebeu.',
  invite_not_found: 'Não encontramos este convite. Confira se abriu o link completo do e-mail.',
  user_not_invited: 'Este acesso já está ativo. É só entrar com seu e-mail e senha.',
  password_too_short: 'A senha precisa ter pelo menos 8 caracteres.',
};

/** Link do login: no subdomínio da empresa quando o convite traz o tenant e estamos em outro endereço. */
function linkDoLogin(tenant: string) {
  const base = env.appBaseDomain;
  if (!tenant || !base || typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host === `${tenant}.${base}`) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenant)) return null;
  return `${window.location.protocol || 'https:'}//${tenant}.${base}/login`;
}

export function AceitarConvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const tenant = (params.get('tenant') ?? '').trim().toLowerCase();
  const loginExterno = linkDoLogin(tenant);

  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [tentou, setTentou] = useState(false);
  const senhaRef = useRef<HTMLInputElement>(null);
  const confirmaRef = useRef<HTMLInputElement>(null);

  const aceitar = useMutation({
    mutationFn: (json: AcceptInviteRequest) =>
      apiFetch<AcceptInviteResponse>('/auth/accept-invite', { method: 'POST', json }),
  });

  const senhaCurta = senha.length < 8;
  const diferentes = !confirma || confirma !== senha;
  const codigoErro = aceitar.isError ? codigoDoErro(aceitar.error) : '';
  const conviteInvalido = ['invite_expired', 'invite_used', 'invite_revoked', 'invite_not_found', 'user_not_invited'].includes(
    codigoErro,
  );

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (senhaCurta) return senhaRef.current?.focus();
    if (diferentes) return confirmaRef.current?.focus();
    aceitar.mutate({ token, password: senha });
  }

  const botaoLogin = (texto: string) =>
    loginExterno ? (
      <a className="btn btn--solido btn--grande btn--largo" href={loginExterno}>
        {texto}
      </a>
    ) : (
      <Link className="btn btn--solido btn--grande btn--largo" to="/login">
        {texto}
      </Link>
    );

  let conteudo: React.ReactNode;
  if (!token) {
    conteudo = (
      <>
        <h1 className="login__titulo">Link incompleto</h1>
        <p className="login__sub">
          Não encontramos o código do convite neste endereço. Abra de novo o link do e-mail de convite (ele é longo: copie
          inteiro, se for colar no navegador).
        </p>
        <div className="formulario">{botaoLogin('Ir para o login')}</div>
      </>
    );
  } else if (aceitar.isSuccess) {
    conteudo = (
      <>
        <h1 className="login__titulo">Acesso ativado</h1>
        <p className="login__sub" role="status">
          Sua senha foi criada. Agora é só entrar com o e-mail <strong>{aceitar.data.email}</strong> e a senha que você
          escolheu.
        </p>
        <div className="formulario">{botaoLogin('Entrar no painel')}</div>
      </>
    );
  } else if (conviteInvalido) {
    conteudo = (
      <>
        <h1 className="login__titulo">Convite indisponível</h1>
        <div className="formulario">
          <p className="formulario__alerta" role="alert">
            {ERROS_CONVITE[codigoErro]}
          </p>
          {botaoLogin('Ir para o login')}
        </div>
      </>
    );
  } else {
    conteudo = (
      <>
        <h1 className="login__titulo">Aceitar convite</h1>
        <p className="login__sub">Crie sua senha para ativar o acesso ao painel.</p>

        <form className="formulario" noValidate onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="cv-senha">Nova senha</label>
            <input
              ref={senhaRef}
              id="cv-senha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              aria-invalid={tentou && senhaCurta}
              aria-describedby="cv-senha-erro"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <p className="campo__erro" id="cv-senha-erro" hidden={!(tentou && senhaCurta)}>
              Use pelo menos 8 caracteres.
            </p>
          </div>
          <div className="campo">
            <label htmlFor="cv-confirma">Confirme a senha</label>
            <input
              ref={confirmaRef}
              id="cv-confirma"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={tentou && !senhaCurta && diferentes}
              aria-describedby="cv-confirma-erro"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
            />
            <p className="campo__erro" id="cv-confirma-erro" hidden={!(tentou && !senhaCurta && diferentes)}>
              As senhas não são iguais.
            </p>
          </div>

          {aceitar.isError && (
            <p className="formulario__alerta" role="alert">
              {ERROS_CONVITE[codigoErro] ?? 'Não foi possível ativar o acesso agora. Tente de novo em instantes.'}
            </p>
          )}

          <button className="btn btn--solido btn--grande btn--largo" type="submit" disabled={aceitar.isPending}>
            {aceitar.isPending ? 'Ativando…' : 'Criar senha e ativar'}
          </button>
        </form>

        <p className="login__novo">
          Já tem senha?{' '}
          {loginExterno ? <a href={loginExterno}>Entrar</a> : <Link to="/login">Entrar</Link>}
        </p>
      </>
    );
  }

  return (
    <div className="site pagina-login">
      <SpriteBrilho />
      <div className="login">
        <aside className="login__marca" aria-label="Sobre o Opiina">
          <Marca className="marca--clara" />
          <div className="login__marca-texto">
            <Selo claro />
            <p className="login__frase">
              Você foi convidado. <span>Falta só criar sua senha.</span>
            </p>
            <ul className="login__lista">
              <li>Pesquisa NPS rápida, em mais de um canal</li>
              <li>Dashboard e métricas por unidade</li>
              <li>Ocorrências organizadas no Kanban</li>
            </ul>
          </div>
          <CreditoDev />
        </aside>

        <main className="login__principal" id="conteudo">
          <Marca className="login__marca-mobile" />
          <div className="login__cartao">{conteudo}</div>
          <CreditoDev mobile />
        </main>
      </div>
    </div>
  );
}
