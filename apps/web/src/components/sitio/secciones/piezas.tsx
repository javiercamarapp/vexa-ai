// Piezas comunes de las secciones de la portada (T8): palabras que se iluminan, botón con círculo y sello de cifra.
// Cero style, cero texto escrito a mano: todo texto llega por props desde el contenido tipado.
import {Fragment} from 'react';
import type {ReactNode} from 'react';

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

/** Numeral de índice con dos cifras. */
export const dosCifras = (n: number): string => String(n).padStart(2, '0');
