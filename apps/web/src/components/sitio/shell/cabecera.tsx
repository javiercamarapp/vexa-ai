// Cabecera del sitio (T7). Marcado según el contrato de T6: header.s-cabecera con data-tema; sitio.js añade data-compacta tras 60 px
// (píldora de vidrio), data-menu-abierto (panel móvil) y data-abierto en los menús. Sin JavaScript los menús abren con hover y foco.
// Componente de servidor: sin 'use client', sin style, sin cookies ni encabezados.
import {Fragment} from 'react';
import {LogoSitio} from '../logo-sitio';
import {enlaceOtroIdioma, hrefAcceso, hrefDe, menus, textosShell} from './datos';
import type {Lang} from './datos';

type Props = {
  lang: Lang;
  /** Id del registro de la página actual; define a dónde apunta el otro idioma. Sin id (404) el selector lleva a las portadas. */
  id: string | null;
  /** Tono bajo el centro de la cabecera al cargar; sitio.js lo actualiza al hacer scroll. */
  tema?: 'oscuro' | 'claro';
};

function Idiomas({lang, id, escritorio}: {lang: Lang; id: string | null; escritorio: boolean}) {
  const t = textosShell(lang);
  const otro = id ? enlaceOtroIdioma(id, lang) : {lang: lang === 'es' ? ('en' as const) : ('es' as const), href: hrefDe('inicio', lang === 'es' ? 'en' : 'es')};
  const actual = {lang, href: id ? hrefDe(id, lang) : hrefDe('inicio', lang)};
  // Orden fijo: ES primero, EN después, en los dos idiomas de la página.
  const lista = [actual, otro].sort((a, b) => (a.lang === 'es' ? -1 : 1) - (b.lang === 'es' ? -1 : 1));
  return (
    <span className={escritorio ? 's-cabecera__idioma s-cabecera__idioma--escritorio' : 's-cabecera__idioma'} role="group" aria-label={t.idioma}>
      {lista.map((x, i) => (
        <Fragment key={x.lang}>
          {i > 0 ? <i aria-hidden="true">/</i> : null}
          {x.lang === lang ? (
            <a href={x.href} hrefLang={x.lang} lang={x.lang} aria-current="true">{x.lang.toUpperCase()}</a>
          ) : (
            <a href={x.href} hrefLang={x.lang} lang={x.lang} aria-label={t.idiomaAria}>{x.lang.toUpperCase()}</a>
          )}
        </Fragment>
      ))}
    </span>
  );
}

export function Cabecera({lang, id, tema = 'oscuro'}: Props) {
  const t = textosShell(lang);
  const grupos = menus(lang);
  const acceso = hrefAcceso(lang);
  return (
    <header className="s-cabecera" data-tema={tema}>
      <div className="s-cabecera__barra">
        <a className="s-cabecera__logo" href={hrefDe('inicio', lang)} aria-label={t.inicio}>
          <LogoSitio tono="doble" etiqueta="" />
        </a>
        <nav className="s-cabecera__nav" aria-label={t.principal}>
          {grupos.map((g) => (
            <div className="s-cabecera__item" key={g.clave}>
              {g.indice ? (
                <a className="s-cabecera__enlace s-cabecera__enlace--menu" href={g.indice} aria-haspopup="true">{g.etiqueta}</a>
              ) : (
                <button className="s-cabecera__enlace s-cabecera__enlace--menu" type="button" aria-haspopup="true">{g.etiqueta}</button>
              )}
              <div className="s-menu">
                {g.items.map((it) => (
                  <a className="s-menu__enlace" href={it.href} key={it.id}>
                    <span className="s-menu__titulo">{it.titulo}</span>
                    {it.texto ? <span className="s-menu__texto">{it.texto}</span> : null}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="s-cabecera__derecha">
          <Idiomas lang={lang} id={id} escritorio />
          <a className="s-boton s-boton--pildora" href={acceso}>{t.cta}</a>
          <button
            className="s-cabecera__burger"
            type="button"
            aria-label={t.menuAbrir}
            aria-controls="panel-movil"
            aria-expanded="false"
            data-etiqueta-abrir={t.menuAbrir}
            data-etiqueta-cerrar={t.menuCerrar}
          />
        </div>
        <nav className="s-panel-movil" id="panel-movil" aria-label={t.principal}>
          {grupos.flatMap((g) =>
            g.items.map((it) => (
              <a className="s-panel-movil__enlace" href={it.href} key={`${g.clave}-${it.id}`}>{it.titulo}</a>
            )),
          )}
          <Idiomas lang={lang} id={id} escritorio={false} />
        </nav>
      </div>
    </header>
  );
}
