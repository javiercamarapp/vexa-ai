// Mensajes de error y validación que arma el servidor, en el idioma de quien hace la petición.
// El `code` estable de cada respuesta NO cambia: solo el texto visible (`message`). Sin dependencias de Next: lo usan rutas, módulos de servidor, el cliente y las pruebas.
import {traducir, type Clave, type Variables} from './index';
import {idiomaDeSolicitud, type Idioma} from './idioma';

/** Claves de este grupo: solo las `tr.err.*` (diccionario d-tr-e.ts). */
export type ClaveError = Extract<Clave, `tr.err.${string}`>;

type Solicitud = {cookies: {get(nombre: string): {value: string} | undefined}; headers?: {get(nombre: string): string | null} | null};
/** Idioma de una petición (NextRequest): cookie rovaq_lang válida (manda), si no el Accept-Language del navegador (es* → es, en* → en, otro → en), si no inglés. Síncrono. */
export function idiomaDePeticion(request: Solicitud): Idioma {
  return idiomaDeSolicitud(request);
}

/** Texto del error en el idioma pedido; reemplaza {variable}. */
export function mensajeError(idioma: Idioma, clave: ClaveError, variables?: Variables): string {
  return traducir(idioma, clave, variables);
}

/** Atajo: `const m = mensajesDe(request)` y luego `m('tr.err.opFallo')`. */
export function mensajesDe(request: Solicitud): (clave: ClaveError, variables?: Variables) => string {
  const idioma = idiomaDePeticion(request);
  return (clave, variables) => mensajeError(idioma, clave, variables);
}
