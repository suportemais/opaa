import { Link } from 'react-router-dom';
import { LOGO_SRC } from './site-utils';

/** Peças do visual do site (LP, login, onboarding). Estilos em src/styles/site.css, sempre sob `.site`. */

/** Símbolo do brilho, reutilizado via <use href="#brilho">. Uma vez por página. */
export function SpriteBrilho() {
  return (
    <svg className="sprite" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="brilho" viewBox="0 0 24 24">
          <path d="M12 2.6c.55 0 .88.55 1.08 2.1.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22.2-1.55.53-2.1 1.08-2.1Z" />
        </symbol>
      </defs>
    </svg>
  );
}

export function Brilho() {
  return (
    <svg aria-hidden="true">
      <use href="#brilho" />
    </svg>
  );
}

export function Selo({ claro = false }: { claro?: boolean }) {
  return (
    <p className={claro ? 'selo selo--claro' : 'selo'}>
      <Brilho />
      Ouça · Entenda · Fidelize
    </p>
  );
}

export function Marca({ className = '', to = '/' }: { className?: string; to?: string }) {
  return (
    <Link className={`marca ${className}`.trim()} to={to} aria-label="Opiina — início">
      <img className="marca__icone" src={LOGO_SRC} alt="" width={256} height={256} />
      <span className="marca__nome">Opiina</span>
    </Link>
  );
}

export function CreditoDev({ mobile = false }: { mobile?: boolean }) {
  return (
    <p className={mobile ? 'login__credito login__credito--mobile' : 'login__credito'}>
      Desenvolvido por{' '}
      <a href="https://devmais.com" target="_blank" rel="noreferrer">
        Dev+
      </a>
    </p>
  );
}
