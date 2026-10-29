// Piezas comunes de las secciones de la portada (T8): palabras que se iluminan, botón con círculo, sello de cifra e imagen del manifest.
// Cero style, cero texto escrito a mano: todo texto llega por props desde el contenido tipado.
import {Fragment} from 'react';
import type {ReactNode} from 'react';
import {alt, medidas, url} from '../../../lib/sitio/activos';

const norma = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Cada palabra en un span con data-i (su posición). sitio.js escribe --i y --n con setProperty; aquí no hay style.
 * Las palabras de `clave` llevan .s-clave: esa frase queda en el color de texto al terminar de iluminarse y no se colorea de rojo.
 */
export function Palabras({texto, clave}: {texto: string; clave?: string}) {
  const claves = new Set((clave ?? '').split(/\s+/).map(norma).filter(Boolean));
  return (
    <>
      {texto.split(/\s+/).map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? ' ' : null}
          <span data-i={i} className={claves.has(norma(p)) ? 's-clave' : undefined}>{p}</span>
        </Fragment>
      ))}
    </>
  );
}

/** Botón primario (círculo rojo de 36 px con flecha, el color lo pone el tema de la sección) o secundario. */
export function Boton({href, children, secundario = false}: {href: string; children: ReactNode; secundario?: boolean}) {
  if (secundario) return <a className="s-boton s-boton--secundario" href={href}>{children}</a>;
  return (
    <a className="s-boton" href={href}>
      {children}
      <span className="s-boton__circulo" aria-hidden="true"><span className="s-flecha" /></span>
    </a>
  );
}

export type ClaseSello = 'observado' | 'estimado' | 'inferido' | 'sindato';
export const CLASES_SELLO: readonly ClaseSello[] = ['observado', 'estimado', 'inferido', 'sindato'];

/** Sello de cifra: la clase se distingue por patrón (relleno, rayado, punteado, guiones), no por color. */
export function Sello({clase, children}: {clase: ClaseSello; children: ReactNode}) {
  return (
    <span className={`s-sello s-sello--${clase}`}>
      <span className="s-sello__icono" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Imagen del manifest con srcset de 480 y 960, ancho y alto del manifest y el alt del idioma (o el que se pase). */
export function ImagenManifest({clave, lang, clase, tamanos, prioridad = false, textoAlt}: {clave: string; lang: 'es' | 'en'; clase?: string; tamanos: string; prioridad?: boolean; textoAlt?: string}) {
  const {ancho, alto} = medidas(clave);
  return (
    <img
      className={clase}
      src={url(clave)}
      srcSet={`${url(clave, {ancho: 480})} 480w, ${url(clave)} ${ancho}w`}
      sizes={tamanos}
      width={ancho}
      height={alto}
      alt={textoAlt ?? alt(clave, lang)}
      decoding="async"
      {...(prioridad ? {fetchPriority: 'high' as const} : {loading: 'lazy' as const})}
    />
  );
}

/** Numeral de índice con dos cifras. */
export const dosCifras = (n: number): string => String(n).padStart(2, '0');
