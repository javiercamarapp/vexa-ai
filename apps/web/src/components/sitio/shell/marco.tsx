// Marco de toda página del sitio (T7): enlace de salto, cabecera, <main id="contenido"> y pie. La raíz .s-pagina contiene el contenido,
// el espaciador y el pie (contrato de T6). Un solo <h1> por página lo pone quien rinde el contenido.
import type {ReactNode} from 'react';
import {Cabecera} from './cabecera';
import {Pie} from './pie';
import {textosShell} from './datos';
import type {Lang} from './datos';

export function MarcoSitio({lang, id, tema = 'oscuro', children}: {lang: Lang; id: string | null; tema?: 'oscuro' | 'claro'; children: ReactNode}) {
  const t = textosShell(lang);
  return (
    <>
      <a className="s-saltar" href="#contenido">{t.saltar}</a>
      <Cabecera lang={lang} id={id} tema={tema} />
      <div className="s-pagina">
        <main id="contenido" tabIndex={-1}>{children}</main>
        <Pie lang={lang} />
      </div>
    </>
  );
}
