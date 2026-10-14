import { useId } from 'react';
import type { Identidade } from './tipos';

/** Chaves "Perguntar quem atendeu" / "Pedir nome e contato" / "Tornar obrigatório" (passo 3 do protótipo). */
export function ChavesIdentificacao({
  valor,
  desativado = false,
  onChange,
}: {
  valor: Identidade;
  desativado?: boolean;
  onChange: (v: Identidade) => void;
}) {
  const id = useId();
  return (
    <div className="chaves">
      <label className="chave">
        <input
          type="checkbox"
          checked={valor.collectEmployee}
          disabled={desativado}
          aria-describedby={`${id}-at`}
          onChange={(e) => onChange({ ...valor, collectEmployee: e.target.checked })}
        />
        <span className="chave__texto">
          Perguntar quem atendeu
          <small id={`${id}-at`}>O cliente escolhe o atendente na lista da unidade.</small>
        </span>
      </label>
      <label className="chave">
        <input
          type="checkbox"
          checked={valor.collectCustomer}
          disabled={desativado}
          aria-describedby={`${id}-id`}
          onChange={(e) =>
            onChange({
              ...valor,
              collectCustomer: e.target.checked,
              requireCustomerIdentity: e.target.checked ? valor.requireCustomerIdentity : false,
            })
          }
        />
        <span className="chave__texto">
          Pedir nome e contato do cliente
          <small id={`${id}-id`}>
            Nome, WhatsApp, e-mail, CPF e data de nascimento. Cria o cadastro em Clientes: útil para retornar quem reclamou
            e lembrar do aniversário.
          </small>
        </span>
      </label>
      <label className="chave chave--sub">
        <input
          type="checkbox"
          checked={valor.requireCustomerIdentity}
          disabled={desativado || !valor.collectCustomer}
          aria-describedby={`${id}-ob`}
          onChange={(e) => onChange({ ...valor, requireCustomerIdentity: e.target.checked })}
        />
        <span className="chave__texto">
          Tornar obrigatório
          <small id={`${id}-ob`}>Sem isso, o cliente pode responder sem se identificar.</small>
        </span>
      </label>
    </div>
  );
}
