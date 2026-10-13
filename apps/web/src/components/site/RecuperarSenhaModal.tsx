import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../../lib/api';

type Props = {
  aberto: boolean;
  emailInicial: string;
  onFechar: () => void;
};

/**
 * "Esqueci minha senha" em <dialog> nativo (prende o foco e fecha com Esc).
 * Usa o mesmo POST /auth/forgot da página /forgot-password, que continua existindo.
 * A confirmação é neutra: não revela se o e-mail tem conta.
 */
export function RecuperarSenhaModal({ aberto, emailInicial, onFechar }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const tituloEnviadoRef = useRef<HTMLHeadingElement>(null);
  const [email, setEmail] = useState('');
  const [tentouEnviar, setTentouEnviar] = useState(false);

  const enviar = useMutation({
    mutationFn: (destino: string) =>
      apiFetch<{ ok: true; sent: number }>('/auth/forgot', { method: 'POST', json: { email: destino } }),
  });

  const resetEnvio = enviar.reset;
  const emailValido = /^\S+@\S+\.\S+$/.test(email);
  const emailInvalido = tentouEnviar && !emailValido;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Só age na transição: com o modal já aberto, mudanças no e-mail do login são ignoradas.
    if (aberto && !dialog.open) {
      resetEnvio();
      setTentouEnviar(false);
      setEmail(emailInicial);
      dialog.showModal();
      emailRef.current?.focus();
    } else if (!aberto && dialog.open) {
      dialog.close();
    }
  }, [aberto, emailInicial, resetEnvio]);

  // Leitor de tela anuncia a confirmação: o foco vai para o título da etapa 2.
  useEffect(() => {
    if (enviar.isSuccess) tituloEnviadoRef.current?.focus();
  }, [enviar.isSuccess]);

  function voltarAoPedido() {
    enviar.reset();
    setTentouEnviar(false);
    requestAnimationFrame(() => {
      emailRef.current?.select();
      emailRef.current?.focus();
    });
  }

  const erroApi = enviar.isError
    ? enviar.error instanceof ApiError
      ? ((enviar.error.body as any)?.message ?? 'Não foi possível processar a solicitação.')
      : 'Não foi possível processar a solicitação.'
    : null;

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={enviar.isSuccess ? 'recuperar-titulo-enviado' : 'recuperar-titulo'}
      onClose={onFechar}
      onClick={(evento) => {
        // Clique no fundo escurecido (fora do cartão) também fecha.
        const dialog = dialogRef.current;
        if (!dialog || evento.target !== dialog) return;
        const caixa = dialog.getBoundingClientRect();
        const dentro =
          evento.clientX >= caixa.left &&
          evento.clientX <= caixa.right &&
          evento.clientY >= caixa.top &&
          evento.clientY <= caixa.bottom;
        if (!dentro) dialog.close();
      }}
    >
      <button className="modal__fechar" type="button" aria-label="Fechar" onClick={() => dialogRef.current?.close()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* Etapa 1: informar o e-mail */}
      <div className="modal__etapa" hidden={enviar.isSuccess}>
        <span className="modal__icone" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
            <path d="M12 14.5v2" />
          </svg>
        </span>
        <h2 className="modal__titulo" id="recuperar-titulo">
          Esqueci minha senha
        </h2>
        <p className="modal__texto">Informe o e-mail da sua conta para receber o link de redefinição.</p>

        <form
          className="formulario modal__form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTentouEnviar(true);
            if (!emailValido) {
              emailRef.current?.focus();
              return;
            }
            enviar.mutate(email);
          }}
        >
          <div className="campo">
            <label htmlFor="recuperar-email">E-mail</label>
            <input
              ref={emailRef}
              id="recuperar-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="email@empresa.com"
              required
              aria-invalid={emailInvalido}
              aria-describedby="recuperar-email-erro"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="campo__erro" id="recuperar-email-erro" hidden={!emailInvalido}>
              Informe um e-mail válido.
            </p>
          </div>
          {erroApi && (
            <p className="formulario__alerta" role="alert">
              {String(erroApi)}
            </p>
          )}
          <button className="btn btn--solido btn--grande btn--largo" type="submit" disabled={enviar.isPending}>
            {enviar.isPending ? 'Enviando...' : 'Enviar link de redefinição'}
          </button>
        </form>
        <button className="modal__voltar" type="button" onClick={() => dialogRef.current?.close()}>
          Lembrou a senha? Voltar para o login
        </button>
      </div>

      {/* Etapa 2: confirmação */}
      <div className="modal__etapa" hidden={!enviar.isSuccess}>
        <span className="modal__icone modal__icone--ok" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
            <path d="M3.5 7l8.5 6 8.5-6" />
          </svg>
        </span>
        <h2 className="modal__titulo" id="recuperar-titulo-enviado" tabIndex={-1} ref={tituloEnviadoRef}>
          Verifique seu e-mail
        </h2>
        <p className="modal__texto">
          Se houver uma conta com <strong>{email}</strong>, enviaremos um link para você criar uma nova senha. O link
          vale por 1 hora.
        </p>
        <p className="modal__dica">Não recebeu? Confira a caixa de spam ou tente de novo com outro e-mail.</p>
        <div className="modal__acoes">
          <button className="btn btn--solido btn--grande btn--largo" type="button" onClick={() => dialogRef.current?.close()}>
            Voltar para o login
          </button>
          <button className="modal__voltar" type="button" onClick={voltarAoPedido}>
            Usar outro e-mail
          </button>
        </div>
      </div>
    </dialog>
  );
}
