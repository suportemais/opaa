import { Icone } from '../Icone';
import { categoriaTexto, dataHora, dataSimples, quando, type DenunciaDetalhe } from './comum';

/** Relato + dados da denúncia (gaveta e página de detalhe). */
export function DadosDenuncia({ d, relatoId }: { d: DenunciaDetalhe; relatoId: string }) {
  const extras: Array<[string, string | null]> = [
    ['Local (texto livre)', d.locationText],
    ['Pessoas envolvidas', d.involvedPeople],
    ['Testemunhas', d.witnesses],
    ['Informações adicionais', d.additionalInfo],
  ];
  return (
    <>
      <section className="den-relato" aria-labelledby={relatoId}>
        <h3 id={relatoId}>Relato</h3>
        <p>{d.description || '—'}</p>
      </section>

      <dl className="dados">
        <div>
          <dt>Categoria</dt>
          <dd>{categoriaTexto(d)}</dd>
        </div>
        <div>
          <dt>Unidade</dt>
          <dd>{d.unit?.name ?? 'Não informada'}</dd>
        </div>
        <div>
          <dt>Recebida</dt>
          <dd>
            {dataHora(d.createdAt)} ({quando(d.createdAt)})
          </dd>
        </div>
        <div>
          <dt>Quando aconteceu</dt>
          <dd>{d.occurredAt ? dataSimples(d.occurredAt) : 'Não informado'}</dd>
        </div>
        <div className="den-dados__largo">
          <dt>Identificação</dt>
          <dd>
            {d.reporterAnonymous ? (
              'Anônima'
            ) : (
              <>
                {d.reporterName ?? 'Nome não informado'}
                {d.reporterEmail && (
                  <span className="den-contato">
                    E-mail: <a href={`mailto:${d.reporterEmail}`}>{d.reporterEmail}</a>
                  </span>
                )}
                {d.reporterPhone && <span className="den-contato">Telefone: {d.reporterPhone}</span>}
                {d.reporterDoc && <span className="den-contato">Documento: {d.reporterDoc}</span>}
              </>
            )}
          </dd>
        </div>
        {extras
          .filter(([, v]) => Boolean(v))
          .map(([rotulo, v]) => (
            <div key={rotulo} className="den-dados__largo">
              <dt>{rotulo}</dt>
              <dd className="den-dados__texto">{v}</dd>
            </div>
          ))}
      </dl>
      {d.reporterAnonymous && (
        <p className="den-anonima">
          <Icone nome="cadeado" />
          Anônima: o canal não guarda quem enviou. Não tente descobrir quem foi.
        </p>
      )}
    </>
  );
}
