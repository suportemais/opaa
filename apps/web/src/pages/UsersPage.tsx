import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { InviteUserResponse } from '../lib/api-novos';
import { ConfigLayout } from '../components/painel/ConfigTabs';
import { Icone } from '../components/painel/Icone';
import { iniciais, useAuthMe } from '../components/painel/usePainel';
import { Gaveta, Situacao } from '../components/painel/config/ui';
import { useAvisar, useConfirmar } from '../components/painel/config/hooks';
import { descr, mensagemDoErro } from '../components/painel/config/erros';
import { AREAS, PERFIS, perfilPorCodigo, precisaDeUnidade, resumoDoPerfil } from '../components/painel/config/perfis';
import '../styles/painel-config.css';

type Unit = { id: string; name: string };
type TenantUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  createdAt: string;
  roles: Array<{ code: string; name: string }>;
  unitAccess: Unit[];
};

const SITUACAO: Record<string, [string, 'publicada' | 'rascunho' | 'arquivada']> = {
  active: ['Ativo', 'publicada'],
  invited: ['Convite enviado', 'rascunho'],
  disabled: ['Desativado', 'arquivada'],
};

const ERROS_USUARIO: Record<string, string> = {
  email_taken: 'Já existe um usuário com esse e-mail.',
  unit_required: 'Escolha pelo menos uma unidade para esse perfil.',
  invalid_unit: 'Uma das unidades escolhidas não existe mais. Recarregue a página.',
  role_not_found: 'Perfil não encontrado.',
  invalid_name: 'Escreva o nome da pessoa.',
  user_not_invited: 'Essa pessoa já aceitou o convite.',
  cannot_disable_self: 'Você não pode desativar o próprio acesso.',
  validation: 'Confira os campos destacados.',
};

const emailValido = (v: string) => /^\S+@\S+\.\S+$/.test(v);

type FormUsuario = {
  name: string;
  email: string;
  phone: string;
  roleCode: string;
  unitIds: string[];
  status: string;
  /** só na criação: 'convite' (e-mail com link) ou 'senha' (senha inicial definida agora) */
  forma: 'convite' | 'senha';
  password: string;
};

const FORM_VAZIO: FormUsuario = {
  name: '',
  email: '',
  phone: '',
  roleCode: 'analyst',
  unitIds: [],
  status: 'active',
  forma: 'convite',
  password: '',
};

export function UsersPage() {
  const qc = useQueryClient();
  const me = useAuthMe();
  const meuId = (me.data as { userId?: string } | undefined)?.userId;
  const [avisar, aviso] = useAvisar();
  const [confirmar, janelaConfirmar] = useConfirmar();

  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });
  const users = useQuery({ queryKey: ['users'], queryFn: () => apiFetch<TenantUser[]>('/users') });

  const [gaveta, setGaveta] = useState<{ modo: 'novo' } | { modo: 'editar'; usuario: TenantUser } | null>(null);
  const [form, setForm] = useState<FormUsuario>(FORM_VAZIO);
  const [tentou, setTentou] = useState(false);
  const [erroGaveta, setErroGaveta] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const unidadesRef = useRef<HTMLFieldSetElement>(null);

  const mudar = <K extends keyof FormUsuario>(campo: K, valor: FormUsuario[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setTentou(false);
    setErroGaveta(null);
    setGaveta({ modo: 'novo' });
  }
  function abrirEdicao(u: TenantUser) {
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone ?? '',
      roleCode: u.roles[0]?.code ?? 'collaborator',
      unitIds: u.unitAccess.map((x) => x.id),
      status: u.status,
      forma: 'convite',
      password: '',
    });
    setTentou(false);
    setErroGaveta(null);
    setResetPassword('');
    setResetMsg(null);
    setGaveta({ modo: 'editar', usuario: u });
  }

  const invalidar = () => qc.invalidateQueries({ queryKey: ['users'] });

  // Convite por e-mail (novo)
  const invite = useMutation({
    mutationFn: (f: FormUsuario) =>
      apiFetch<InviteUserResponse>('/users/invite', {
        method: 'POST',
        json: {
          name: f.name.trim(),
          email: f.email.trim(),
          roleCode: f.roleCode,
          unitIds: f.unitIds.length ? f.unitIds : undefined,
        },
      }),
    onSuccess: async (r, f) => {
      setGaveta(null);
      const email = f.email.trim();
      if (!r.inviteSent) avisar(`Usuário criado, mas o e-mail não saiu agora. Use “Reenviar convite” para ${email}.`);
      else avisar(r.resent ? `Já havia convite pendente: reenviamos para ${email}` : `Convite enviado para ${email}`);
      await invalidar();
    },
    onError: (err) => setErroGaveta(mensagemDoErro(err, ERROS_USUARIO, 'Não foi possível enviar o convite.')),
  });

  // Cadastro com senha inicial (como antes)
  const create = useMutation({
    mutationFn: (f: FormUsuario) =>
      apiFetch<{ id: string }>('/users', {
        method: 'POST',
        json: {
          name: f.name.trim(),
          email: f.email.trim(),
          phone: f.phone.trim() || undefined,
          password: f.password,
          roleCode: f.roleCode,
          unitIds: f.unitIds.length ? f.unitIds : undefined,
        },
      }),
    onSuccess: async (_, f) => {
      setGaveta(null);
      avisar(`${f.name.trim()} cadastrado(a). Passe a senha inicial para a pessoa.`);
      await invalidar();
    },
    onError: (err) =>
      setErroGaveta(mensagemDoErro(err, ERROS_USUARIO, 'Não foi possível criar o usuário. Verifique e-mail, perfil e unidades.')),
  });

  const update = useMutation({
    mutationFn: (vars: { usuario: TenantUser; f: FormUsuario }) => {
      const { usuario, f } = vars;
      return apiFetch<{ ok: boolean }>(`/users/${encodeURIComponent(usuario.id)}`, {
        method: 'PATCH',
        json: {
          name: f.name.trim() || undefined,
          email: f.email.trim() || undefined,
          phone: f.phone.trim(),
          // A situação só vai quando muda (assim um convite pendente não vira "ativo" sem senha)
          status: f.status !== usuario.status ? f.status : undefined,
          roleCode: f.roleCode,
          unitIds: f.unitIds,
        },
      });
    },
    onSuccess: async (_, vars) => {
      setGaveta(null);
      avisar(`${vars.f.name.trim()} atualizado(a)`);
      await invalidar();
    },
    onError: (err) => setErroGaveta(mensagemDoErro(err, ERROS_USUARIO, 'Não foi possível salvar.')),
  });

  const setUserPassword = useMutation({
    mutationFn: (vars: { id: string; password: string }) =>
      apiFetch<{ ok: boolean }>(`/users/${encodeURIComponent(vars.id)}/password`, {
        method: 'POST',
        json: { password: vars.password },
      }),
    onSuccess: async () => {
      setResetPassword('');
      setResetMsg({ ok: true, texto: 'Senha atualizada. Passe a nova senha para a pessoa.' });
      await invalidar();
    },
    onError: () => setResetMsg({ ok: false, texto: 'Não foi possível definir a senha.' }),
  });

  const disableUser = useMutation({
    mutationFn: (u: TenantUser) => apiFetch<{ ok: boolean }>(`/users/${encodeURIComponent(u.id)}`, { method: 'DELETE' }),
    onSuccess: async (_, u) => {
      setGaveta(null);
      avisar(`${u.name} foi desativado(a)`);
      await invalidar();
    },
    onError: (err) => avisar(mensagemDoErro(err, ERROS_USUARIO, 'Não foi possível desativar.')),
  });

  const reativar = useMutation({
    mutationFn: (u: TenantUser) =>
      apiFetch<{ ok: boolean }>(`/users/${encodeURIComponent(u.id)}`, { method: 'PATCH', json: { status: 'active' } }),
    onSuccess: async (_, u) => {
      avisar(`${u.name} voltou a ter acesso`);
      await invalidar();
    },
    onError: (err) => avisar(mensagemDoErro(err, ERROS_USUARIO, 'Não foi possível reativar.')),
  });

  const resend = useMutation({
    mutationFn: (u: TenantUser) =>
      apiFetch<InviteUserResponse>(`/users/${encodeURIComponent(u.id)}/resend-invite`, { method: 'POST' }),
    onSuccess: async (r, u) => {
      avisar(r.inviteSent ? `Convite reenviado para ${u.email}` : `O e-mail não saiu agora. Tente de novo em instantes.`);
      await invalidar();
    },
    onError: (err) => avisar(mensagemDoErro(err, ERROS_USUARIO, 'Não foi possível reenviar o convite.')),
  });

  async function pedirDesativar(u: TenantUser) {
    const ok = await confirmar({
      titulo: `Desativar ${u.name}?`,
      texto: 'A pessoa perde o acesso ao painel na hora. O histórico dela continua guardado, e dá para reativar depois.',
      botao: 'Desativar',
      perigo: true,
      icone: 'cadeado',
    });
    if (ok) disableUser.mutate(u);
  }

  // ----- Validação da gaveta -----
  const novo = gaveta?.modo === 'novo';
  const editandoEu = gaveta?.modo === 'editar' && gaveta.usuario.id === meuId;
  const erros = {
    name: !form.name.trim(),
    email: !emailValido(form.email.trim()),
    password: novo && form.forma === 'senha' && form.password.trim().length < 8,
    unidades: precisaDeUnidade(form.roleCode) && form.unitIds.length === 0,
  };

  function salvar() {
    setTentou(true);
    setErroGaveta(null);
    if (erros.name) return nomeRef.current?.focus();
    if (erros.email) return emailRef.current?.focus();
    if (erros.password) return senhaRef.current?.focus();
    if (erros.unidades) return unidadesRef.current?.querySelector('input')?.focus();
    if (gaveta?.modo === 'editar') update.mutate({ usuario: gaveta.usuario, f: form });
    else if (form.forma === 'senha') create.mutate(form);
    else invite.mutate(form);
  }

  const todasUnidades = units.data ?? [];
  const todasMarcadas = todasUnidades.length > 0 && todasUnidades.every((u) => form.unitIds.includes(u.id));
  const lista = users.data ?? [];

  return (
    <ConfigLayout>
      <div className="cfg__pilha">
        <section className="cartao cfg__cartao" aria-labelledby="t-usuarios">
          <div className="cfg__topo">
            <div>
              <h2 className="cartao__titulo" id="t-usuarios">
                Usuários
              </h2>
              <p className="cartao__sub">Quem acessa o painel. O perfil define o que cada pessoa vê.</p>
            </div>
            <button className="btn btn--primario" type="button" onClick={abrirNovo}>
              <Icone nome="mais" />
              Convidar usuário
            </button>
          </div>

          {users.isLoading && <p className="mudo">Carregando usuários…</p>}
          {users.isError && (
            <p className="campo__erro" role="alert">
              Não foi possível carregar os usuários (verifique se você tem permissão).
            </p>
          )}

          {users.data && (
            <div className="tabela-rolagem">
              <table className="tabela cfg-tabela">
                <thead>
                  <tr>
                    <th scope="col">Pessoa</th>
                    <th scope="col">Perfil</th>
                    <th scope="col">Unidades</th>
                    <th scope="col">Situação</th>
                    <th scope="col">
                      <span className="visualmente-oculto">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lista.length === 0 && (
                    <tr>
                      <td colSpan={5} className="vazio">
                        <strong>Nenhum usuário</strong>
                      </td>
                    </tr>
                  )}
                  {lista.map((u) => {
                    const role = u.roles[0];
                    const perfil = perfilPorCodigo(role?.code);
                    const [rotulo, tipo] = SITUACAO[u.status] ?? [u.status, 'arquivada'];
                    const eu = u.id === meuId;
                    const todas = perfil?.permissoes.includes('unit:manage');
                    return (
                      <tr key={u.id} className={u.status === 'disabled' ? 'cfg-tabela__inativo' : undefined}>
                        <th scope="row">
                          <span className="pessoa">
                            <span className="avatar avatar--p" aria-hidden="true">
                              {iniciais(u.name)}
                            </span>
                            <span className="pessoa__texto">
                              <span>
                                {u.name}
                                {eu && <span className="mudo"> (você)</span>}
                              </span>
                              <small>{u.email}</small>
                              {u.phone && <small>{u.phone}</small>}
                            </span>
                          </span>
                        </th>
                        <td>
                          <span className={`selo-perfil selo-perfil--${perfil?.selo ?? 'colaborador'}`}>
                            {perfil?.nome ?? role?.name ?? '—'}
                          </span>
                        </td>
                        <td>
                          {u.unitAccess.length ? (
                            u.unitAccess.map((x) => x.name).join(', ')
                          ) : todas ? (
                            'Todas'
                          ) : (
                            <span className="mudo">—</span>
                          )}
                        </td>
                        <td>
                          <span className="cfg-situacao">
                            <Situacao tipo={tipo}>{rotulo}</Situacao>
                            {u.status === 'invited' && (
                              <button
                                className="link-texto cfg-situacao__link"
                                type="button"
                                disabled={resend.isPending}
                                onClick={() => resend.mutate(u)}
                              >
                                {resend.isPending && resend.variables?.id === u.id ? 'Reenviando…' : 'Reenviar convite'}
                                <span className="visualmente-oculto"> para {u.name}</span>
                              </button>
                            )}
                          </span>
                        </td>
                        <td className="cfg-tabela__acoes">
                          <button className="btn btn--fantasma" type="button" onClick={() => abrirEdicao(u)}>
                            <Icone nome="editar" />
                            Editar<span className="visualmente-oculto"> {u.name}</span>
                          </button>
                          {u.status === 'active' && !eu && (
                            <button
                              className="btn btn--fantasma"
                              type="button"
                              disabled={disableUser.isPending}
                              onClick={() => pedirDesativar(u)}
                            >
                              Desativar<span className="visualmente-oculto"> {u.name}</span>
                            </button>
                          )}
                          {u.status === 'disabled' && (
                            <button
                              className="btn btn--fantasma"
                              type="button"
                              disabled={reativar.isPending}
                              onClick={() => reativar.mutate(u)}
                            >
                              Reativar<span className="visualmente-oculto"> {u.name}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="cartao cfg__cartao" aria-labelledby="t-matriz">
          <div className="cfg__topo">
            <div>
              <h2 className="cartao__titulo" id="t-matriz">
                O que cada perfil vê
              </h2>
              <p className="cartao__sub">
                Os perfis são fixos do sistema. Gestores, Marketing e Colaborador veem só as unidades do próprio acesso.
              </p>
            </div>
          </div>
          <ul className="cfg-perfis">
            {PERFIS.map((p) => (
              <li key={p.code}>
                <span className={`selo-perfil selo-perfil--${p.selo}`}>{p.nome}</span>
                <span>{p.descricao}</span>
              </li>
            ))}
          </ul>
          <div className="tabela-rolagem">
            <table className="tabela matriz">
              <caption className="visualmente-oculto">O que cada perfil vê e faz no painel</caption>
              <thead>
                <tr>
                  <th scope="col">Área</th>
                  {PERFIS.map((p) => (
                    <th key={p.code} scope="col" className="matriz__perfil">
                      {p.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AREAS.map((a) => (
                  <tr key={a.nome}>
                    <th scope="row">{a.nome}</th>
                    {PERFIS.map((p) =>
                      !a.permissao || p.permissoes.includes(a.permissao) ? (
                        <td key={p.code} className="matriz__sim">
                          <Icone nome="ok" />
                          <span className="visualmente-oculto">Sim</span>
                        </td>
                      ) : (
                        <td key={p.code} className="matriz__nao">
                          <span aria-hidden="true">—</span>
                          <span className="visualmente-oculto">Não</span>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Gaveta
        larga
        aberta={!!gaveta}
        titulo={gaveta?.modo === 'editar' ? `Editar ${gaveta.usuario.name}` : 'Convidar usuário'}
        botao={novo ? (form.forma === 'senha' ? 'Cadastrar' : 'Enviar convite') : 'Salvar'}
        ocupado={invite.isPending || create.isPending || update.isPending}
        onFechar={() => setGaveta(null)}
        onSalvar={salvar}
      >
        <div className="campo">
          <label htmlFor="us-nome">
            Nome <span className="obrigatorio" aria-hidden="true">*</span>
          </label>
          <input
            ref={nomeRef}
            id="us-nome"
            autoComplete="off"
            required
            aria-invalid={tentou && erros.name}
            aria-describedby={descr('us-nome', false, true)}
            value={form.name}
            onChange={(e) => mudar('name', e.target.value)}
          />
          <p className="campo__erro" id="us-nome-erro" hidden={!(tentou && erros.name)}>
            Escreva o nome da pessoa.
          </p>
        </div>
        <div className="campos-2">
          <div className="campo">
            <label htmlFor="us-email">
              E-mail <span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <input
              ref={emailRef}
              id="us-email"
              type="email"
              autoComplete="off"
              required
              aria-invalid={tentou && erros.email}
              aria-describedby={descr('us-email', !novo, true)}
              value={form.email}
              onChange={(e) => mudar('email', e.target.value)}
            />
            {!novo && (
              <p className="campo__dica" id="us-email-dica">
                É o login da pessoa.
              </p>
            )}
            <p className="campo__erro" id="us-email-erro" hidden={!(tentou && erros.email)}>
              Confira o e-mail.
            </p>
          </div>
          <div className="campo">
            <label htmlFor="us-telefone">
              Telefone <span className="opcional">(opcional)</span>
            </label>
            <input
              id="us-telefone"
              type="tel"
              autoComplete="off"
              placeholder="(00) 00000-0000"
              aria-describedby={novo && form.forma === 'convite' ? 'us-telefone-dica' : undefined}
              value={form.phone}
              onChange={(e) => mudar('phone', e.target.value)}
              disabled={novo && form.forma === 'convite'}
            />
            {novo && form.forma === 'convite' && (
              <p className="campo__dica" id="us-telefone-dica">
                No convite, a própria pessoa informa o telefone em Minha conta.
              </p>
            )}
          </div>
        </div>

        <fieldset className="perfis-op">
          <legend>Perfil</legend>
          {editandoEu && <p className="campo__dica">Cuidado ao mudar o próprio perfil: você pode perder o acesso a esta tela.</p>}
          {PERFIS.map((p) => (
            <label key={p.code} className="perfil-op">
              <input
                type="radio"
                name="us-perfil"
                value={p.code}
                checked={form.roleCode === p.code}
                onChange={() => mudar('roleCode', p.code)}
              />
              <span className="perfil-op__texto">
                <strong>{p.nome}</strong>
                <span>{p.descricao}</span>
                <small>Vê: {resumoDoPerfil(p)}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="unidades-op" ref={unidadesRef} aria-describedby="us-unidades-dica us-unidades-erro">
          <legend>Acesso às unidades</legend>
          <p className="campo__dica" id="us-unidades-dica">
            {precisaDeUnidade(form.roleCode)
              ? 'Esse perfil vê só as unidades marcadas. Escolha pelo menos uma.'
              : 'O Administrador vê todas as unidades, marcadas ou não.'}
          </p>
          {todasUnidades.length > 1 && (
            <label className="marcar">
              <input
                type="checkbox"
                checked={todasMarcadas}
                onChange={(e) => mudar('unitIds', e.target.checked ? todasUnidades.map((u) => u.id) : [])}
              />
              <span>Marcar todas</span>
            </label>
          )}
          {todasUnidades.map((u) => (
            <label key={u.id} className={todasUnidades.length > 1 ? 'marcar marcar--sub' : 'marcar'}>
              <input
                type="checkbox"
                checked={form.unitIds.includes(u.id)}
                onChange={(e) =>
                  mudar('unitIds', e.target.checked ? [...form.unitIds, u.id] : form.unitIds.filter((x) => x !== u.id))
                }
              />
              {u.name}
            </label>
          ))}
          {!units.isLoading && todasUnidades.length === 0 && <p className="mudo">Nenhuma unidade cadastrada.</p>}
          <p className="campo__erro" id="us-unidades-erro" hidden={!(tentou && erros.unidades)}>
            Escolha pelo menos uma unidade.
          </p>
        </fieldset>

        {novo && (
          <fieldset className="perfis-op">
            <legend>Como a pessoa vai entrar</legend>
            <label className="perfil-op">
              <input type="radio" name="us-forma" checked={form.forma === 'convite'} onChange={() => mudar('forma', 'convite')} />
              <span className="perfil-op__texto">
                <strong>Enviar convite por e-mail</strong>
                <span>A pessoa recebe um link (válido por 7 dias) para criar a própria senha.</span>
              </span>
            </label>
            <label className="perfil-op">
              <input type="radio" name="us-forma" checked={form.forma === 'senha'} onChange={() => mudar('forma', 'senha')} />
              <span className="perfil-op__texto">
                <strong>Definir uma senha inicial agora</strong>
                <span>O acesso já fica ativo. Você passa a senha para a pessoa.</span>
              </span>
            </label>
          </fieldset>
        )}
        {novo && form.forma === 'senha' && (
          <div className="campo">
            <label htmlFor="us-senha">Senha inicial</label>
            <input
              ref={senhaRef}
              id="us-senha"
              type="password"
              autoComplete="new-password"
              aria-invalid={tentou && erros.password}
              aria-describedby={descr('us-senha', true, true)}
              value={form.password}
              onChange={(e) => mudar('password', e.target.value)}
            />
            <p className="campo__dica" id="us-senha-dica">
              Pelo menos 8 caracteres.
            </p>
            <p className="campo__erro" id="us-senha-erro" hidden={!(tentou && erros.password)}>
              A senha precisa ter pelo menos 8 caracteres.
            </p>
          </div>
        )}

        {gaveta?.modo === 'editar' && (
          <div className="campo">
            <label htmlFor="us-situacao">Situação</label>
            <select id="us-situacao" value={form.status} onChange={(e) => mudar('status', e.target.value)} disabled={editandoEu}>
              {gaveta.usuario.status === 'invited' && <option value="invited">Convite enviado</option>}
              <option value="active">Ativo</option>
              <option value="disabled">Desativado</option>
            </select>
          </div>
        )}

        {erroGaveta && (
          <p className="campo__erro" role="alert">
            {erroGaveta}
          </p>
        )}

        {gaveta?.modo === 'editar' && (
          <div className="cfg-subsecao">
            <h3 className="cartao__titulo">Definir nova senha</h3>
            <p className="campo__dica">Troca a senha da pessoa na hora. Ela sai de todos os aparelhos.</p>
            <div className="cfg__linha">
              <div className="campo">
                <label htmlFor="us-nova-senha">Nova senha</label>
                <input
                  id="us-nova-senha"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    setResetMsg(null);
                  }}
                />
              </div>
              <button
                className="btn btn--secundario"
                type="button"
                disabled={setUserPassword.isPending || resetPassword.trim().length < 8}
                onClick={() => setUserPassword.mutate({ id: gaveta.usuario.id, password: resetPassword })}
              >
                {setUserPassword.isPending ? 'Aplicando…' : 'Aplicar'}
              </button>
            </div>
            {resetMsg && (
              <p className={resetMsg.ok ? 'cfg-ok' : 'campo__erro'} role={resetMsg.ok ? 'status' : 'alert'}>
                {resetMsg.texto}
              </p>
            )}
          </div>
        )}

        {gaveta?.modo === 'editar' && !editandoEu && gaveta.usuario.status === 'active' && (
          <div className="cfg-perigo">
            <p>
              <strong>Desativar acesso</strong>A pessoa deixa de entrar no painel. Dá para reativar depois.
            </p>
            <button className="btn btn--perigo" type="button" onClick={() => pedirDesativar(gaveta.usuario)}>
              Desativar
            </button>
          </div>
        )}
      </Gaveta>
      {janelaConfirmar}
      {aviso}
    </ConfigLayout>
  );
}
