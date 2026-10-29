// 404 propio del sitio (T7): con el shell, útil y noindex. Vive junto a [...ruta] para que Next la use dentro del layout del sitio (que pone el <html>);
// el idioma llega por idioma-actual porque no-encontrada no recibe params. Responde 404 real: las rutas desconocidas se reescriben a __404.
import type {Metadata} from 'next';
import {MarcoSitio} from '../../../../../components/sitio/shell/marco';
import {hrefAcceso, hrefDe, menus} from '../../../../../components/sitio/shell/datos';
import {idiomaActual} from '../../../../../components/sitio/shell/idioma-actual';

export const metadata: Metadata = {title: {absolute: 'Página no encontrada | Rovaq AI'}, robots: {index: false, follow: true}};

const TEXTO = {
  es: {
    eyebrow: 'Error 404',
    h1: 'No encontramos esta página',
    sub: 'La dirección no existe o cambió. Estos enlaces te llevan a donde puedes seguir.',
    inicio: 'Ir al inicio',
    acceso: 'Solicitar acceso',
    ayuda: 'Si llegaste aquí desde un enlace nuestro, escríbenos y lo corregimos.',
  },
  en: {
    eyebrow: 'Error 404',
    h1: 'We could not find this page',
    sub: 'The address does not exist or has moved. These links take you where you can continue.',
    inicio: 'Go to the home page',
    acceso: 'Request access',
    ayuda: 'If you arrived from one of our links, write to us and we will fix it.',
  },
} as const;

export default function NoEncontrada() {
  const lang = idiomaActual();
  const t = TEXTO[lang];
  const enlaces = menus(lang).flatMap((g) => g.items.map((it) => ({href: it.href, titulo: it.titulo})));
  return (
    <MarcoSitio lang={lang} id={null}>
      <section className="s-seccion s-pag-cabeza" data-tema="oscuro">
        <div className="s-contenedor s-pila-24">
          <p className="s-eyebrow">{t.eyebrow}</p>
          <h1 className="s-h2-grande s-ancho-titular">{t.h1}</h1>
          <p className="s-lead">{t.sub}</p>
          <div className="s-fila">
            <a className="s-boton" href={hrefDe('inicio', lang)}>
              {t.inicio}
              <span className="s-boton__circulo">
                <span className="s-flecha" aria-hidden="true" />
              </span>
            </a>
            <a className="s-boton s-boton--secundario" href={hrefAcceso(lang)}>{t.acceso}</a>
          </div>
        </div>
      </section>
      {enlaces.length > 0 ? (
        <section className="s-seccion s-costura s-costura--a-claro" data-tema="claro">
          <div className="s-contenedor s-pag-contenido">
            <div className="s-pag-bloque">
              <h2 className="s-h3-serif s-pag-titulo">{lang === 'es' ? 'Páginas del sitio' : 'Pages on this site'}</h2>
              <ul className="s-lista">
                {enlaces.map((e) => (
                  <li key={e.href}><a className="s-enlace" href={e.href}>{e.titulo}</a></li>
                ))}
              </ul>
              <p className="s-pequeno s-apagado">{t.ayuda}</p>
            </div>
          </div>
        </section>
      ) : null}
    </MarcoSitio>
  );
}
