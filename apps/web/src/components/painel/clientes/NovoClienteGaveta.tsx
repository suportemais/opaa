import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../../../lib/api';
import type { CreateCustomerRequest } from '../../../lib/api-novos';
import { Icone } from '../Icone';
import { type Cliente, type Unidade, emailValido, erroCliente, soDigitos } from './util';

type Campo = 'nome' | 'telefone' | 'email' | 'nascimento' | 'unidade';

/** Cadastro manual (POST /customers). Conteúdo da gaveta "Novo cliente". */
export function NovoClienteConteudo(props: {
  unidades: Unidade[];
  todasUnidades: boolean;
  onFechar: () => void;
  onCriado: (c: Cliente) => void;
  onAbrirExistente: (id: string) => void;
}) {
  const qc = useQueryClient();
  const unica = props.unidades.length === 1 ? props.unidades[0].id : '';
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [unidadeId, setUnidadeId] = useState(unica);
  const [ofertas, setOfertas] = useState(false);
  const [notas, setNotas] = useState('');
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [existente, setExistente] = useState<string | null>(null);
  const unidadeObrigatoria = !props.todasUnidades;

  const criar = useMutation({
    mutationFn: () => {
      const corpo: CreateCustomerRequest = {
        name: nome.trim(),
        email: email.trim() || undefined,
        phone: telefone.trim() || undefined,
        originUnitId: unidadeId || undefined,
        birthDate: nascimento || undefined,
        acceptsOffers: ofertas ? true : undefined,
        notes: notas.trim() || undefined,
      };
      return apiFetch<Cliente>('/customers', { method: 'POST', json: corpo });
    },
    onSuccess: async (c) => {
      await qc.invalidateQueries({ queryKey: ['customers'] });
      props.onCriado(c);
    },
    onError: (err) => {
      const body = err instanceof ApiError && err.body && typeof err.body === 'object' ? (err.body as { code?: string; id?: string }) : null;
      if (body?.code === 'customer_exists' && body.id) setExistente(body.id);
      setErroGeral(erroCliente(err, 'Não foi possível cadastrar.'));
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const novo: Partial<Record<Campo, string>> = {};
    if (!nome.trim()) novo.nome = 'Informe o nome.';
    const dig = soDigitos(telefone);
    if (telefone.trim() && (dig.length < 10 || dig.length > 13)) novo.telefone = 'Use DDD + número.';
    if (email.trim() && !emailValido(email)) novo.email = 'Confira o e-mail.';
    if (!telefone.trim() && !email.trim()) novo.telefone = 'Informe o WhatsApp ou o e-mail.';
    if (nascimento && nascimento > new Date().toISOString().slice(0, 10)) novo.nascimento = 'A data não pode ser no futuro.';
    if (unidadeObrigatoria && !unidadeId) novo.unidade = 'Escolha a unidade.';
    setErros(novo);
    setErroGeral(null);
    setExistente(null);
    const primeiro = (['nome', 'telefone', 'email', 'nascimento', 'unidade'] as const).find((k) => novo[k]);
    if (primeiro) {
      document.getElementById(`cn-${primeiro}`)?.focus();
      return;
    }
    criar.mutate();
  }

  const limpar = (k: Campo) => erros[k] && setErros((v) => ({ ...v, [k]: undefined }));
  const attrs = (k: Campo) => ({
    id: `cn-${k}`,
    'aria-invalid': erros[k] ? true : undefined,
    'aria-describedby': `cn-${k}-erro`,
  });
  const erro = (k: Campo) => (
    <p className="campo__erro" id={`cn-${k}-erro`} hidden={!erros[k]}>
      {erros[k]}
    </p>
  );

  return (
    <form className="gaveta__corpo" onSubmit={enviar} noValidate>
      <div className="gaveta__topo">
        <h2 className="cfg-gaveta__titulo" id="cn-titulo" tabIndex={-1}>
          Novo cliente
        </h2>
        <button className="botao-icone" type="button" aria-label="Fechar" onClick={props.onFechar}>
          <Icone nome="fechar" />
        </button>
      </div>
      <div className="gaveta__form">
        <div className="campo">
          <label htmlFor="cn-nome">
            Nome <span className="obrigatorio" aria-hidden="true">*</span>
          </label>
          <input {...attrs('nome')} type="text" autoComplete="off" required value={nome} onChange={(e) => { setNome(e.target.value); limpar('nome'); }} />
          {erro('nome')}
        </div>
        <div className="campos-2">
          <div className="campo">
            <label htmlFor="cn-telefone">WhatsApp / telefone</label>
            <input {...attrs('telefone')} type="tel" inputMode="tel" autoComplete="off" placeholder="(00) 00000-0000" value={telefone} onChange={(e) => { setTelefone(e.target.value); limpar('telefone'); }} />
            {erro('telefone')}
          </div>
          <div className="campo">
            <label htmlFor="cn-email">E-mail</label>
            <input {...attrs('email')} type="email" autoComplete="off" placeholder="nome@email.com" value={email} onChange={(e) => { setEmail(e.target.value); limpar('email'); }} />
            {erro('email')}
          </div>
        </div>
        <div className="campos-2">
          <div className="campo">
            <label htmlFor="cn-nascimento">
              Data de nascimento <span className="cl-mudo">(opcional)</span>
            </label>
            <input {...attrs('nascimento')} type="date" max={new Date().toISOString().slice(0, 10)} value={nascimento} onChange={(e) => { setNascimento(e.target.value); limpar('nascimento'); }} />
            {erro('nascimento')}
          </div>
          <div className="campo">
            <label htmlFor="cn-unidade">
              Unidade {unidadeObrigatoria && <span className="obrigatorio" aria-hidden="true">*</span>}
            </label>
            <select {...attrs('unidade')} value={unidadeId} onChange={(e) => { setUnidadeId(e.target.value); limpar('unidade'); }}>
              <option value="">{unidadeObrigatoria ? 'Escolha a unidade' : 'Sem unidade'}</option>
              {props.unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {erro('unidade')}
          </div>
        </div>
        <label className="cl-opcao">
          <input type="checkbox" checked={ofertas} onChange={(e) => setOfertas(e.target.checked)} />
          <span>
            <strong>Aceita receber ofertas</strong>
            Marque só se o próprio cliente autorizou (LGPD).
          </span>
        </label>
        <div className="campo">
          <label htmlFor="cn-notas">
            Observações internas <span className="cl-mudo">(opcional)</span>
          </label>
          <textarea id="cn-notas" rows={3} maxLength={2000} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
      </div>

      {erroGeral && (
        <p className="cl-lgpd" role="alert">
          <Icone nome="alerta" />
          <span>
            {erroGeral}
            {existente && (
              <>
                {' '}
                <button type="button" className="link-texto" onClick={() => props.onAbrirExistente(existente)}>
                  Abrir o cadastro existente
                </button>
              </>
            )}
          </span>
        </p>
      )}

      <div className="gaveta__acoes">
        <button className="btn btn--secundario" type="button" onClick={props.onFechar}>
          Cancelar
        </button>
        <button className="btn btn--primario" type="submit" disabled={criar.isPending}>
          {criar.isPending ? 'Cadastrando…' : 'Cadastrar cliente'}
        </button>
      </div>
    </form>
  );
}
