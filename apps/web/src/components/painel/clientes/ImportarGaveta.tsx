import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../../../lib/api';
import { Icone } from '../Icone';
import { type ResultadoImportacao, baixarModeloImportacao, erroCliente } from './util';

/** Conteúdo da gaveta "Importar planilha". */
export function ImportarConteudo(props: { onFechar: () => void; onImportado: (r: ResultadoImportacao) => void }) {
  const qc = useQueryClient();
  const arquivoRef = useRef<HTMLInputElement | null>(null);
  const [erroArquivo, setErroArquivo] = useState('');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const importar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiFetch<ResultadoImportacao>('/customers/import', { method: 'POST', body: form });
    },
    onSuccess: async (r) => {
      setResultado(r);
      setErro(null);
      if (arquivoRef.current) arquivoRef.current.value = '';
      await qc.invalidateQueries({ queryKey: ['customers'] });
      props.onImportado(r);
    },
    onError: (err) => {
      const body = err instanceof ApiError && err.body && typeof err.body === 'object' ? (err.body as { errors?: ResultadoImportacao['errors'] }) : null;
      setErro(erroCliente(err, 'Falha ao importar.'));
      setResultado(body?.errors ? { imported: 0, errors: body.errors } : null);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const file = arquivoRef.current?.files?.[0];
    if (!file) {
      setErroArquivo('Escolha o arquivo da planilha.');
      arquivoRef.current?.focus();
      return;
    }
    setResultado(null);
    setErro(null);
    importar.mutate(file);
  }

  return (
    <form className="gaveta__corpo" onSubmit={enviar} noValidate>
      <div className="gaveta__topo">
        <h2 className="cfg-gaveta__titulo" id="ci-titulo" tabIndex={-1}>
          Importar planilha
        </h2>
        <button className="botao-icone" type="button" aria-label="Fechar" onClick={props.onFechar}>
          <Icone nome="fechar" />
        </button>
      </div>
      <ol className="cl-passos">
        <li>
          <strong>Baixe o modelo</strong>
          <span>
            Colunas: Nome, E-mail, Telefone (WhatsApp), CPF, Unidade, Nascimento (dd/mm/aaaa), Aceita ofertas (sim/não) e
            Observações. Uma pessoa por linha. Nome e Unidade são obrigatórios, e é preciso ter e-mail, telefone ou CPF.
            Nascimento e Aceita ofertas são opcionais. Até 2.000 linhas.
          </span>
          <button className="btn btn--secundario" type="button" onClick={baixarModeloImportacao}>
            Baixar modelo (CSV)
          </button>
        </li>
        <li>
          <strong>Preencha e envie</strong>
          <div className="campo">
            <label htmlFor="ci-arquivo">Arquivo CSV</label>
            <input
              ref={arquivoRef}
              id="ci-arquivo"
              type="file"
              accept=".csv,text/csv"
              aria-invalid={erroArquivo ? true : undefined}
              aria-describedby="ci-arquivo-erro"
              onChange={() => setErroArquivo('')}
            />
            <p className="campo__erro" id="ci-arquivo-erro" hidden={!erroArquivo}>
              {erroArquivo}
            </p>
          </div>
        </li>
      </ol>
      <p className="cl-lgpd">
        <Icone nome="alerta" />
        <span>
          <strong>Só importe quem autorizou.</strong> Marque “sim” em Aceita ofertas apenas para quem deu esse
          consentimento. Quem já está cadastrado (mesmo telefone, e-mail ou CPF) é atualizado, não duplicado.
        </span>
      </p>

      {(resultado || erro) && (
        <div role="status" aria-live="polite" className="cl-import-resultado">
          {erro && (
            <p className="cl-lgpd">
              <Icone nome="alerta" />
              <span>{erro}</span>
            </p>
          )}
          {resultado && !erro && (
            <p className="cl-consentimento cl-consentimento--sim">
              <Icone nome="ok" />
              <span>
                <strong>{resultado.created ?? resultado.imported} criado(s)</strong>
                {typeof resultado.updated === 'number' ? ` · ${resultado.updated} atualizado(s)` : ''}
                {typeof resultado.total === 'number' ? ` · ${resultado.total} linha(s) lidas` : ''}.
              </span>
            </p>
          )}
          {resultado?.errors && resultado.errors.length > 0 && (
            <ul className="cl-import-erros">
              {resultado.errors.map((e, i) => (
                <li key={`${e.row}-${i}`}>
                  {e.row > 0 ? `Linha ${e.row}: ` : ''}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="gaveta__acoes">
        <button className="btn btn--secundario" type="button" onClick={props.onFechar}>
          {resultado && !erro ? 'Fechar' : 'Cancelar'}
        </button>
        <button className="btn btn--primario" type="submit" disabled={importar.isPending}>
          {importar.isPending ? 'Importando…' : 'Importar'}
        </button>
      </div>
    </form>
  );
}
