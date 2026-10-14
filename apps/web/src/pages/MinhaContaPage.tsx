import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { UpdateMeRequest } from '../lib/api-novos';
import { ConfigLayout } from '../components/painel/ConfigTabs';
import { nomePerfil, useAuthMe } from '../components/painel/usePainel';
import { useAvisar } from '../components/painel/config/hooks';
import { descr, mensagemDoErro } from '../components/painel/config/erros';
import { perfilPorCodigo, resumoDoPerfil } from '../components/painel/config/perfis';
import '../styles/painel-config.css';
import { abrirTour } from '../components/painel/usePainel';

type Me = { name: string; email?: string; phone?: string | null; roleCodes?: string[]; roleNames?: string[]; unitIds?: string[] };

export function MinhaContaPage() {
  const qc = useQueryClient();
  const me = useAuthMe();
  const dados = me.data as (Me & { permissionCodes: string[] }) | undefined;
  const [avisar, aviso] = useAvisar();

  // ----- Seus dados -----
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tentouDados, setTentouDados] = useState(false);
  const [erroDados, setErroDados] = useState<string | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const telRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dados) return;
    setNome(dados.name ?? '');
    setTelefone(dados.phone ?? '');
  }, [dados]);

  const digitos = telefone.replace(/\D/g, '');
  const errosDados = {
    nome: !nome.trim(),
    telefone: Boolean(digitos) && (digitos.length < 10 || digitos.length > 11),
  };

  const salvarDados = useMutation({
    mutationFn: (json: UpdateMeRequest) => apiFetch('/auth/me', { method: 'PATCH', json }),
    onSuccess: async () => {
      setErroDados(null);
      avisar('Seus dados foram salvos');
      await qc.invalidateQueries({ queryKey: ['authMe'] });
    },
    onError: (err) =>
      setErroDados(mensagemDoErro(err, { invalid_name: 'Escreva seu nome.' }, 'Não foi possível salvar. Tente de novo.')),
  });

  // ----- Trocar senha -----
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [tentouSenha, setTentouSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const atualRef = useRef<HTMLInputElement>(null);
  const novaRef = useRef<HTMLInputElement>(null);
  const confirmaRef = useRef<HTMLInputElement>(null);

  const errosSenha = {
    atual: !atual,
    nova: nova.trim().length < 8,
    confirma: !confirma || confirma !== nova,
  };

  const trocarSenha = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>('/auth/change-password', {
        method: 'POST',
        json: { currentPassword: atual, newPassword: nova },
      }),
    onSuccess: () => {
      setAtual('');
      setNova('');
      setConfirma('');
      setTentouSenha(false);
      setErroSenha(null);
      avisar('Senha trocada');
    },
    onError: () => setErroSenha('Não foi possível trocar a senha. Confira a senha atual.'),
  });

  const perfil = perfilPorCodigo(dados?.roleCodes?.[0]);

  return (
    <ConfigLayout>
      <div className="cfg__pilha">
        <form
          className="cartao cfg__cartao"
          noValidate
          aria-labelledby="t-conta"
          onSubmit={(e) => {
            e.preventDefault();
            setTentouDados(true);
            setErroDados(null);
            if (errosDados.nome) return nomeRef.current?.focus();
            if (errosDados.telefone) return telRef.current?.focus();
            salvarDados.mutate({ name: nome.trim(), phone: telefone.trim() });
          }}
        >
          <div className="cfg__topo">
            <div>
              <h2 className="cartao__titulo" id="t-conta">
                Seus dados
              </h2>
            </div>
          </div>
          {me.isLoading && <p className="mudo">Carregando…</p>}
          <div className="cfg__grade">
            <div className="campo">
              <label htmlFor="m-nome">Nome</label>
              <input
                ref={nomeRef}
                id="m-nome"
                autoComplete="name"
                required
                aria-invalid={tentouDados && errosDados.nome}
                aria-describedby={descr('m-nome', false, true)}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <p className="campo__erro" id="m-nome-erro" hidden={!(tentouDados && errosDados.nome)}>
                Escreva seu nome.
              </p>
            </div>
            <div className="campo">
              <label htmlFor="m-email">E-mail de acesso</label>
              <input id="m-email" type="email" readOnly value={dados?.email ?? ''} aria-describedby="m-email-dica" />
              <p className="campo__dica" id="m-email-dica">
                É com ele que você entra no painel. Para trocar, peça a um administrador.
              </p>
            </div>
            <div className="campo">
              <label htmlFor="m-telefone">
                Celular / WhatsApp <span className="opcional">(opcional)</span>
              </label>
              <input
                ref={telRef}
                id="m-telefone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                aria-invalid={tentouDados && errosDados.telefone}
                aria-describedby={descr('m-telefone', false, true)}
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
              <p className="campo__erro" id="m-telefone-erro" hidden={!(tentouDados && errosDados.telefone)}>
                Confira o número: DDD + número (10 ou 11 dígitos).
              </p>
            </div>
          </div>
          <div className="cfg__fixo">
            <span className="cfg__fixo-rotulo">Seu perfil</span>
            <strong>{perfil?.nome ?? nomePerfil(dados)}</strong>
            {perfil && <span className="campo__dica">Vê: {resumoDoPerfil(perfil)}.</span>}
          </div>
          {erroDados && (
            <p className="campo__erro" role="alert">
              {erroDados}
            </p>
          )}
          <div className="cfg__salvar cfg__salvar--dentro">
            <button className="btn btn--primario" type="submit" disabled={salvarDados.isPending || !dados}>
              {salvarDados.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>

        <form
          className="cartao cfg__cartao"
          noValidate
          aria-labelledby="t-senha"
          onSubmit={(e) => {
            e.preventDefault();
            setTentouSenha(true);
            setErroSenha(null);
            if (errosSenha.atual) return atualRef.current?.focus();
            if (errosSenha.nova) return novaRef.current?.focus();
            if (errosSenha.confirma) return confirmaRef.current?.focus();
            trocarSenha.mutate();
          }}
        >
          <div className="cfg__topo">
            <div>
              <h2 className="cartao__titulo" id="t-senha">
                Trocar senha
              </h2>
              <p className="cartao__sub">Use pelo menos 8 caracteres.</p>
            </div>
          </div>
          {/* Campo de usuário oculto: ajuda o gerenciador de senhas a saber de qual conta é a senha */}
          <input type="email" name="usuario" autoComplete="username" hidden readOnly value={dados?.email ?? ''} />
          <div className="cfg__grade cfg__grade--1">
            <div className="campo">
              <label htmlFor="s-atual">Senha atual</label>
              <input
                ref={atualRef}
                id="s-atual"
                type="password"
                autoComplete="current-password"
                aria-invalid={tentouSenha && errosSenha.atual}
                aria-describedby={descr('s-atual', false, true)}
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
              />
              <p className="campo__erro" id="s-atual-erro" hidden={!(tentouSenha && errosSenha.atual)}>
                Digite sua senha atual.
              </p>
            </div>
            <div className="campo">
              <label htmlFor="s-nova">Nova senha</label>
              <input
                ref={novaRef}
                id="s-nova"
                type="password"
                autoComplete="new-password"
                minLength={8}
                aria-invalid={tentouSenha && errosSenha.nova}
                aria-describedby={descr('s-nova', false, true)}
                value={nova}
                onChange={(e) => setNova(e.target.value)}
              />
              <p className="campo__erro" id="s-nova-erro" hidden={!(tentouSenha && errosSenha.nova)}>
                A nova senha precisa ter pelo menos 8 caracteres.
              </p>
            </div>
            <div className="campo">
              <label htmlFor="s-confirma">Confirme a nova senha</label>
              <input
                ref={confirmaRef}
                id="s-confirma"
                type="password"
                autoComplete="new-password"
                aria-invalid={tentouSenha && errosSenha.confirma}
                aria-describedby={descr('s-confirma', false, true)}
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
              />
              <p className="campo__erro" id="s-confirma-erro" hidden={!(tentouSenha && errosSenha.confirma)}>
                As senhas não são iguais.
              </p>
            </div>
          </div>
          {erroSenha && (
            <p className="campo__erro" role="alert">
              {erroSenha}
            </p>
          )}
          <div className="cfg__salvar cfg__salvar--dentro">
            <button className="btn btn--primario" type="submit" disabled={trocarSenha.isPending}>
              {trocarSenha.isPending ? 'Trocando…' : 'Trocar senha'}
            </button>
          </div>
        </form>

        <section className="cartao cfg__cartao" aria-labelledby="t-tour">
          <div className="cfg__topo">
            <div>
              <h2 className="cartao__titulo" id="t-tour">
                Tour do painel
              </h2>
              <p className="cartao__sub">Reveja onde fica cada coisa no menu.</p>
            </div>
            <button className="btn btn--secundario" type="button" onClick={abrirTour}>
              Rever o tour
            </button>
          </div>
        </section>
      </div>
      {aviso}
    </ConfigLayout>
  );
}
