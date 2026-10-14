import { iniciais } from '../usePainel';
import { quando, textoEvento, type EventoCaso, dataCompleta } from './comum';

/** Responsável com avatar de iniciais (como htmlResponsavel do protótipo). */
export function Responsavel({ nome, eu }: { nome: string | null | undefined; eu?: boolean }) {
  if (!nome) {
    return (
      <span className="responsavel responsavel--vazio">
        <span className="avatar avatar--p avatar--vazio" aria-hidden="true">
          ?
        </span>
        Sem responsável
      </span>
    );
  }
  return (
    <span className="responsavel">
      <span className="avatar avatar--p" aria-hidden="true">
        {iniciais(nome)}
      </span>
      {eu ? `${nome} (você)` : nome}
    </span>
  );
}

/** Histórico do caso, do mais recente para o mais antigo. */
export function HistoricoCaso({
  eventos,
  nomeUsuario,
  tituloId,
  titulo = 'Histórico',
}: {
  eventos: EventoCaso[];
  nomeUsuario: (id: string) => string | undefined;
  tituloId: string;
  titulo?: string;
}) {
  const lista = [...eventos].reverse();
  return (
    <section className="historico" aria-labelledby={tituloId}>
      <h3 className="historico__titulo" id={tituloId}>
        {titulo}
      </h3>
      {lista.length === 0 ? (
        <p className="fbx-mudo">Nada registrado ainda.</p>
      ) : (
        <ul>
          {lista.map((e) => (
            <li key={e.id}>
              {textoEvento(e, nomeUsuario)}
              <span className="historico__quando">
                <time dateTime={e.createdAt} title={dataCompleta(e.createdAt)}>
                  {quando(e.createdAt)}
                </time>
                {e.createdBy?.name ? ` · ${e.createdBy.name}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
