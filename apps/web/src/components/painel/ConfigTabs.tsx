import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Icone } from './Icone';
import { ABAS, podeCom } from './configAbas';
import { useAuthMe } from './usePainel';

/** Moldura das telas de Configurações: abas à esquerda (no celular, em linha) e o conteúdo. */
export function ConfigLayout({ children }: { children: ReactNode }) {
  const me = useAuthMe();
  const p = podeCom(me.data?.permissionCodes ?? []);
  const abas = ABAS.filter((a) => a.pode(p));
  return (
    <>
      <header className="cabeca">
        <div>
          <h1 className="cabeca__titulo">Configurações</h1>
        </div>
      </header>
      <div className={abas.length > 1 ? 'cfg' : 'cfg cfg--so-conta'}>
        {abas.length > 1 && (
          <nav className="cfg__nav" aria-label="Seções das configurações">
            {abas.map((a) => (
              // NavLink já marca aria-current="page" no link ativo (o CSS do protótipo usa isso)
              <NavLink key={a.to} to={a.to}>
                <Icone nome={a.icone} />
                {a.rotulo}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="cfg__conteudo">{children}</div>
      </div>
    </>
  );
}
