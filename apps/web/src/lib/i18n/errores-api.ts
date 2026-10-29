// Mensajes de error y validación que arma el servidor, en el idioma de quien hace la petición.
// El `code` estable de cada respuesta NO cambia: solo el texto visible (`message`). Sin dependencias de Next: lo usan rutas, módulos de servidor, el cliente y las pruebas.
import {traducir, type Clave, type Variables} from './index';
import {COOKIE_IDIOMA, resolverIdioma, type Idioma} from './idioma';

/** Claves de este grupo: solo las `tr.err.*` (diccionario d-tr-e.ts). */
export type ClaveError = Extract<Clave, `tr.err.${string}`>;

/** Idioma de una petición con cookies (NextRequest): cookie rovaq_lang válida, o inglés. Síncrono; el Accept-Language no interviene. */
export function idiomaDePeticion(request: {cookies: {get(nombre: string): {value: string} | undefined}}): Idioma {
  return resolverIdioma({cookie: request.cookies.get(COOKIE_IDIOMA)?.value});
}

/** Texto del error en el idioma pedido; reemplaza {variable}. */
export function mensajeError(idioma: Idioma, clave: ClaveError, variables?: Variables): string {
  return traducir(idioma, clave, variables);
}

/** Atajo: `const m = mensajesDe(request)` y luego `m('tr.err.opFallo')`. */
export function mensajesDe(request: {cookies: {get(nombre: string): {value: string} | undefined}}): (clave: ClaveError, variables?: Variables) => string {
  const idioma = idiomaDePeticion(request);
  return (clave, variables) => mensajeError(idioma, clave, variables);
}
