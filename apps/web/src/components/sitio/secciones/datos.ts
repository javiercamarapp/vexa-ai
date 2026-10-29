// Datos de la portada (T8): todo el texto sale del árbol de publicar() de T11 (marcadores resueltos, hojas alternas aplicadas, lo no
// publicable omitido), proyectado a un idioma. Ningún componente de secciones escribe un texto a mano ni lee LANDING sin pasar por aquí.
// Los enlaces se validan contra el registro K2: una página no publicable no se enlaza (el componente recibe null).
import {LANDING} from '../../../content/sitio/landing';
import aprobaciones from '../../../content/sitio/aprobaciones.json';
import {idDeRuta} from '../../../content/sitio/registro.mjs';
import {contextoPorDefecto, proyectarArbol, publicar} from '../../../lib/sitio/marcadores.mjs';
import type {Aprobaciones} from '../../../lib/sitio/marcadores.mjs';
import {esPublicable, hrefAcceso, hrefMailto} from '../shell/datos';
import type {Lang} from '../shell/datos';

export type {Lang};

type Pantalla = {t: string; href: string};
export type Columna = {n: string; t: string; d: string; alt: string};
export type Modulo = {etiqueta: string; nombre: string; titulo: string; texto: string; limite?: string; pantallas: Pantalla[]; mockup: 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6'};

/** Forma de lo que la portada lee del contenido. Los campos opcionales pueden faltar si su hoja no es publicable. */
export type TextosPortada = {
  carga: {etiqueta: string; omitir: string};
  hero: {eyebrow: string; titulo?: string; titularReserva: string; subtitulo?: string; limite?: string; cta: string; ctaSecundario: string; micro: string; rotulo: string; scroll: string};
  puente: {etiqueta: string; titulo?: string; reglas: string[]};
  problema: {etiqueta: string; titulo: string; resaltada: string; apoyo: string; columnas: Columna[]};
  clases: {etiqueta: string; titulo: string; items: {nombre: string; d: string; sello: string}[]; reglaEtiqueta: string; regla: string; campos: string[]; enlace?: string; href?: string};
  valor: {etiqueta: string; titulo: string; cotaAlt: string};
  modulos: {etiqueta: string; titulo: string; tituloEscena: string; apoyo: string; contador: string[]; respaldoSinMovimiento: string; items: Modulo[]; enlaceLimites: string};
  puestos: {etiqueta: string; titulo: string; capsulaAlt: string; items: {t: string; d: string; ve: string; href: string}[]; lideres: {titulo: string; finanzas: {t: string; d?: string; href: string}; cx: {t: string; d?: string; salvedad?: string; href: string}}; enlaceItem: string; cierre: string};
  pantallas: {etiqueta: string; titulo: string; apoyo: string; items: {t: string; pregunta: string; d?: string; mockup: 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6'; href: string}[]; enlaceItem: string; enlaceTodas: string; hrefTodas: string};
  seguridad: {etiqueta: string; titulo: string; hechos: string[]; hayEtiqueta: string; hay: string[]; noHayEtiqueta: string; noHay: string[]; enlace: string; href: string; fecha?: string};
  integraciones: {etiqueta: string; titulo: string; subtitulo: string; hoyEtiqueta: string; hoy: {n: string; d: string}[]; rutaEtiqueta: string; ruta: string[]; posicion?: string; chipsFila1: string[]; chipsFila2: string[]; chipEtiquetaRuta: string; enlace: string; href: string; enlaceRuta: string; hrefRuta: string};
  limites: {titulo: string; subtitulo: string; items: string[]; cierre: string; enlace: string; href: string};
  faq: {etiqueta: string; titulo: string; items: {q?: string; a?: string}[]};
  cierre: {titulo: string; texto: string; objetoAlt: string; cta: string; ctaSecundario: string; precio: string; ayudaCorreo: string; incluir: string[]};
  micro: {etiquetas: {hoy: string; ruta: string}};
  imagenes: Record<string, string>;
};

const CTX = contextoPorDefecto();
const PUBLICADO = publicar(LANDING, {aprobaciones: aprobaciones as unknown as Aprobaciones, ctx: CTX, prefijo: ''}).arbol;

const CACHE = new Map<Lang, TextosPortada>();
export function textosPortada(lang: Lang): TextosPortada {
  let t = CACHE.get(lang);
  if (!t) {
    t = proyectarArbol(PUBLICADO, lang) as unknown as TextosPortada;
    CACHE.set(lang, t);
  }
  return t;
}

/** Enlace a una página interna solo si el registro la publica; null en cualquier otro caso (no se enlaza). */
export function enlaceInterno(href: string | undefined): string | null {
  if (!href) return null;
  const r = idDeRuta(href);
  return r && esPublicable(r.id) ? href : null;
}

/** Correo de solicitud de acceso con asunto y cuerpo del cierre; sin contacto resuelto cae al enlace de acceso del shell. */
export const correoAcceso = (lang: Lang): string => hrefMailto(lang) ?? hrefAcceso(lang);

/**
 * Parte un titular en dos líneas de largo parecido, cortando entre palabras (sin escribir texto a mano).
 * Si ya hay dos líneas o una sola palabra devuelve lo que hay.
 */
export function enDosLineas(texto: string): string[] {
  const palabras = texto.trim().split(/\s+/);
  if (palabras.length < 2) return [texto];
  let mejor = 1;
  let dif = Infinity;
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(' ').length;
    const b = palabras.slice(i).join(' ').length;
    if (Math.abs(a - b) < dif) { dif = Math.abs(a - b); mejor = i; }
  }
  return [palabras.slice(0, mejor).join(' '), palabras.slice(mejor).join(' ')];
}

/** Primera oración y el resto de un texto de una fila de límites. */
export function partirOracion(texto: string): {titulo: string; resto: string} {
  const m = /^(.+?[.!?])\s+(.+)$/s.exec(texto.trim());
  return m ? {titulo: m[1], resto: m[2]} : {titulo: texto, resto: ''};
}

/** Un sello de cifra de cuatro oraciones (clase, fuente, corte, antigüedad) en sus cuatro partes; null si no son cuatro. */
export function partesSello(texto: string): string[] | null {
  const partes = texto.split(/\.\s+/).map((p) => p.replace(/\.$/, '').trim()).filter(Boolean);
  return partes.length === 4 ? partes : null;
}

export const sinPuntoFinal = (s: string): string => s.replace(/[.,;:]+$/, '');
