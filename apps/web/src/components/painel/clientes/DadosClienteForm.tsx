import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import type { UpdateCustomerExtras } from '../../../lib/api-novos';
import { Icone } from '../Icone';
import { type Cliente, type Unidade, dataCurta, dataIso, emailValido, erroCliente, origemTexto } from './util';

type Erros = Partial<Record<'nome' | 'telefone' | 'email' | 'nascimento' | 'geral', string>>;

/**
 * Dados do cliente (nome, contato, nascimento, unidade e aceite de ofertas), no estilo do protótipo.
 * Usado na gaveta da lista e na página /app/customers/:id. Salva com PATCH /customers/:id.
 */
export function DadosClienteForm(props: {
  cliente: Cliente;
  unidades: Unidade[];
  podeEditar: boolean;
  /** prefixo dos ids dos campos (evita ids repetidos) */
  prefixo: string;
  onSalvo?: (c: Cliente) => void;
  onCancelar?: () => void;
  rotuloCancelar?: string;
}) {
  const { cliente: c, podeEditar, prefixo: px } = props;
  const qc = useQueryClient();
  const [nome, setNome] = useState(c.name ?? '');
  const [telefone, setTelefone] = useState(c.phone ?? '');
  const [email, setEmail] = useState(c.email ?? '');
  const [nascimento, setNascimento] = useState(dataIso(c.birthDate));
  const [unidadeId, setUnidadeId] = useState(c.originUnitId ?? c.originUnit?.id ?? '');
  const [ofertas, setOfertas] = useState<boolean | null>(c.acceptsOffers ?? null);
  const [erros, setErros] = useState<Erros>({});

  const salvar = useMutation({
    mutationFn: () => {
      const corpo: Record<string, unknown> & UpdateCustomerExtras = {
        name: nome.trim() || undefined,
        email: email.trim() || undefined,
        phone: telefone.trim() || undefined,
        originUnitId: unidadeId || undefined,
      };
      if (nascimento !== dataIso(c.birthDate)) corpo.birthDate = nascimento;
      // Cada mudança de aceite vira um registro de consentimento: só envia quando mudou.
      if (ofertas !== null && ofertas !== (c.acceptsOffers ?? null)) corpo.acceptsOffers = ofertas;
      return apiFetch<Cliente>(`/customers/${c.id}`, { method: 'PATCH', json: corpo });
    },
    onSuccess: async (salvo) => {
      await qc.invalidateQueries({ queryKey: ['customer', c.id] });
      await qc.invalidateQueries({ queryKey: ['customers'] });
      props.onSalvo?.(salvo);
    },
    onError: (err) => setErros({ geral: erroCliente(err) }),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!podeEditar) return;
    const novo: Erros = {};
    if (email.trim() && !emailValido(email)) novo.email = 'Confira o e-mail.';
    if (nascimento && nascimento > new Date().toISOString().slice(0, 10)) novo.nascimento = 'A data não pode ser no futuro.';
    setErros(novo);
    const primeiro = (['email', 'nascimento'] as const).find((k) => novo[k]);
    if (primeiro) {
      document.getElementById(`${px}-${primeiro}`)?.focus();
      return;
    }
    salvar.mutate();
  }

  const unidadeFora = unidadeId && !props.unidades.some((u) => u.id === unidadeId) ? c.originUnit : null;
  const mudou = (k: keyof Erros) => () => erros[k] && setErros((v) => ({ ...v, [k]: undefined }));

  return (
    <form className="cl-detalhe" onSubmit={enviar} noValidate>
      <section className="rk-detalhe__bloco" aria-labelledby={`${px}-t-dados`}>
        <h3 id={`${px}-t-dados`}>Dados</h3>
        <div className="campo">
          <label htmlFor={`${px}-nome`}>Nome</label>
          <input
            id={`${px}-nome`}
            type="text"
            autoComplete="off"
            value={nome}
            disabled={!podeEditar}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div className="campos-2">
          <div className="campo">
            <label htmlFor={`${px}-telefone`}>WhatsApp / telefone</label>
            <input
              id={`${px}-telefone`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="(00) 00000-0000"
              value={telefone}
              disabled={!podeEditar}
              onChange={(e) => {
                setTelefone(e.target.value);
                mudou('telefone')();
              }}
            />
          </div>
          <div className="campo">
            <label htmlFor={`${px}-email`}>E-mail</label>
            <input
              id={`${px}-email`}
              type="email"
              autoComplete="off"
              placeholder="nome@email.com"
              value={email}
              disabled={!podeEditar}
              aria-invalid={erros.email ? true : undefined}
              aria-describedby={`${px}-email-erro`}
              onChange={(e) => {
                setEmail(e.target.value);
                mudou('email')();
              }}
            />
            <p className="campo__erro" id={`${px}-email-erro`} hidden={!erros.email}>
              {erros.email}
            </p>
          </div>
        </div>
        <div className="campos-2">
          <div className="campo cl-nascimento">
            <label htmlFor={`${px}-nascimento`}>
              Data de nascimento <span className="cl-mudo">(opcional)</span>
            </label>
            <input
              id={`${px}-nascimento`}
              type="date"
              value={nascimento}
              max={new Date().toISOString().slice(0, 10)}
              disabled={!podeEditar}
              aria-invalid={erros.nascimento ? true : undefined}
              aria-describedby={`${px}-nascimento-erro`}
              onChange={(e) => {
                setNascimento(e.target.value);
                mudou('nascimento')();
              }}
            />
            <p className="campo__erro" id={`${px}-nascimento-erro`} hidden={!erros.nascimento}>
              {erros.nascimento}
            </p>
          </div>
          <div className="campo">
            <label htmlFor={`${px}-unidade`}>Unidade</label>
            <select
              id={`${px}-unidade`}
              value={unidadeId}
              disabled={!podeEditar}
              onChange={(e) => setUnidadeId(e.target.value)}
            >
              <option value="">Selecione a unidade</option>
              {props.unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
              {unidadeFora && <option value={unidadeFora.id}>{unidadeFora.name}</option>}
            </select>
          </div>
        </div>
        <p className="cartao__sub">
          {origemTexto(c.source)} · cliente desde {dataCurta(c.createdAt)}
        </p>
      </section>

      <section className="rk-detalhe__bloco" aria-labelledby={`${px}-t-ofertas`}>
        <h3 id={`${px}-t-ofertas`}>Ofertas e novidades</h3>
        <p className={`cl-consentimento${c.acceptsOffers ? ' cl-consentimento--sim' : ''}`}>
          <Icone nome={c.acceptsOffers ? 'ok' : 'cadeado'} />
          <span>
            {c.acceptsOffers === true && (
              <>
                <strong>Aceita receber.</strong> Aceite registrado
                {c.acceptsOffersAt ? ` em ${dataCurta(c.acceptsOffersAt)}` : ''}.
              </>
            )}
            {c.acceptsOffers === false && (
              <>
                <strong>Não aceita receber.</strong> Não inclua em campanhas.
              </>
            )}
            {c.acceptsOffers == null && (
              <>
                <strong>Não informado.</strong> Sem aceite registrado: não inclua em campanhas.
              </>
            )}
          </span>
        </p>
        {podeEditar && (
          <fieldset className="cl-opcoes">
            <legend>Alterar o aceite</legend>
            <label className="cl-opcao">
              <input
                type="radio"
                name={`${px}-ofertas`}
                checked={ofertas === true}
                onChange={() => setOfertas(true)}
              />
              <span>
                <strong>Aceita receber ofertas</strong>
                Marque só se o próprio cliente autorizou.
              </span>
            </label>
            <label className="cl-opcao">
              <input
                type="radio"
                name={`${px}-ofertas`}
                checked={ofertas === false}
                onChange={() => setOfertas(false)}
              />
              <span>
                <strong>Não aceita</strong>
                Use quando o cliente pedir para não receber.
              </span>
            </label>
          </fieldset>
        )}
      </section>

      {erros.geral && (
        <p className="cl-lgpd" role="alert">
          <Icone nome="alerta" />
          <span>{erros.geral}</span>
        </p>
      )}

      {(podeEditar || props.onCancelar) && (
        <div className="gaveta__acoes cl-acoes">
          {props.onCancelar && (
            <button className="btn btn--secundario" type="button" onClick={props.onCancelar}>
              {props.rotuloCancelar ?? 'Cancelar'}
            </button>
          )}
          {podeEditar && (
            <button className="btn btn--primario" type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
