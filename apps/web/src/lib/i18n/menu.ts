import {es, type Clave} from './es';
import type {Traductor} from './index';
// Rótulos del menú por idioma. menu.mjs conserva el español como texto canónico (pruebas y rutas); aquí solo se mapea cada ítem a su clave del diccionario.
type ItemMenu = {href: string; etiqueta: string; titulo?: string};
const slug = (href: string) => href.replace(/^\//, '').replace(/\//g, '-');
const existe = (clave: string): clave is Clave => clave in es;
export const claveItem = (href: string) => `nav.item.${slug(href)}` as Clave;
export const claveTitulo = (href: string) => `nav.titulo.${slug(href)}` as Clave;
export const claveGrupo = (grupo: string) => `nav.grupo.${grupo}` as Clave;
/** Etiqueta del ítem en el idioma activo (si falta la clave, queda el español canónico). */
export const etiquetaItem = (t: Traductor, item: ItemMenu) => (existe(claveItem(item.href)) ? t(claveItem(item.href)) : item.etiqueta);
/** Título (tooltip y encabezado) del ítem: su título propio si lo tiene, si no su etiqueta. */
export function tituloItem(t: Traductor, item: ItemMenu) {
  if (item.titulo && item.titulo !== item.etiqueta && existe(claveTitulo(item.href))) return t(claveTitulo(item.href));
  return etiquetaItem(t, item);
}
export const etiquetaGrupo = (t: Traductor, grupo: {clave: string; etiqueta: string}) => (existe(claveGrupo(grupo.clave)) ? t(claveGrupo(grupo.clave)) : grupo.etiqueta);
/** Base económica en el idioma activo; una clave sin traducción conserva la etiqueta en español de jerga.mjs (nunca se inventa). */
export const etiquetaBaseT = (t: Traductor, clave: string, canonica: string) => (existe('base.' + clave) ? t(('base.' + clave) as Clave) : canonica);
