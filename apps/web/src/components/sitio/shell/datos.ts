// Datos del shell del sitio (T7): qué páginas son publicables, menús, columnas del pie y enlaces entre idiomas.
// Todo sale del registro K2 y del árbol de publicar() (T11), nunca de LANDING directo: una página o una hoja no publicable
// no aparece en ningún menú ni enlace. Se calcula una vez por proceso de build.
import {PAGINAS, idDeRuta, porId, rutaDe} from '../../../content/sitio/registro.mjs';
import type {IdiomaSitio} from '../../../content/sitio/registro.mjs';
import {LANDING} from '../../../content/sitio/landing';
import {PAGINA_POR_ID} from '../../../content/sitio/paginas/index';
import type {Pagina, Bi} from '../../../content/sitio/tipos';
import aprobaciones from '../../../content/sitio/aprobaciones.json';
import {construirMailto, contextoPorDefecto, estadoPagina, proyectarArbol, publicar} from '../../../lib/sitio/marcadores.mjs';
import type {Aprobaciones} from '../../../lib/sitio/marcadores.mjs';

export type Lang = IdiomaSitio;
export const IDIOMAS_VALIDOS: readonly Lang[] = ['es', 'en'];
export const esLang = (x: string): x is Lang => (IDIOMAS_VALIDOS as readonly string[]).includes(x);

const APROB = aprobaciones as unknown as Aprobaciones;
const CTX = contextoPorDefecto();

/**
 * Las páginas de contenido (T11) se identifican como producto/hoy o casos-de-uso/propietario; el registro K2, como hoy y propietario.
 * Los índices y las páginas sueltas coinciden. Esta función une los dos; una página de contenido sin id en el registro rompe el build.
 */
function idRegistroDe(idContenido: string): string {
  if (idContenido === 'producto' || idContenido === 'casos-de-uso') return idContenido;
  const ultimo = idContenido.split('/').pop() as string;
  if (!porId(ultimo)) throw new Error(`CONTENIDO_SIN_REGISTRO: ${idContenido}`);
  return ultimo;
}
const PAGINA_DE_REGISTRO = new Map<string, Pagina>(Object.values(PAGINA_POR_ID).map((p) => [idRegistroDe(p.id), p]));

/** Estado de publicación de cada página del registro. La portada siempre se publica; una sin contenido escrito no se publica. */
const ESTADOS = new Map<string, {publicable: boolean; motivos: string[]}>();
for (const p of PAGINAS) {
  if (p.id === 'inicio') { ESTADOS.set(p.id, {publicable: true, motivos: []}); continue; }
  const contenido = PAGINA_DE_REGISTRO.get(p.id);
  if (!contenido) { ESTADOS.set(p.id, {publicable: false, motivos: ['sin contenido escrito']}); continue; }
  const e = estadoPagina(contenido, {aprobaciones: APROB, ctx: CTX});
  ESTADOS.set(p.id, {publicable: e.publicable, motivos: e.motivos});
}

export const esPublicable = (id: string): boolean => ESTADOS.get(id)?.publicable === true;
export const motivosNoPublicable = (id: string): string[] => ESTADOS.get(id)?.motivos ?? ['no está en el registro'];
export const idsPublicables = (): string[] => PAGINAS.filter((p) => esPublicable(p.id)).map((p) => p.id);

export const hrefDe = (id: string, lang: Lang): string => rutaDe(id, lang) ?? (lang === 'en' ? '/en' : '/');
export const enlaceOtroIdioma = (id: string, lang: Lang): {lang: Lang; href: string} => {
  const otro: Lang = lang === 'es' ? 'en' : 'es';
  return {lang: otro, href: hrefDe(id, otro)};
};

/** Página publicable detrás de una ruta de contenido (la del idioma pedido), o null. */
function idPublicableDeRuta(ruta: string): string | null {
  const r = idDeRuta(ruta);
  return r && esPublicable(r.id) ? r.id : null;
}

export type EnlaceMenu = {id: string; titulo: string; texto: string; href: string};
export type GrupoMenu = {clave: 'producto' | 'casos' | 'recursos'; etiqueta: string; indice: string | null; items: EnlaceMenu[]};

type ItemNav = {t: Bi; d?: Bi; href: Bi};
type GrupoNav = {etiqueta: Bi; items: readonly ItemNav[]};

/** Menús Producto, Casos de uso y Recursos: hojas publicables (publicar) y páginas publicables (registro). Un grupo sin entradas no se emite. */
export function menus(lang: Lang): GrupoMenu[] {
  const nav = publicar(LANDING.nav, {aprobaciones: APROB, ctx: CTX, prefijo: 'nav'}).arbol as unknown as Record<string, GrupoNav>;
  const claves: GrupoMenu['clave'][] = ['producto', 'casos', 'recursos'];
  const indices: Record<GrupoMenu['clave'], string | null> = {producto: 'producto', casos: 'casos-de-uso', recursos: null};
  return claves
    .map((clave): GrupoMenu => {
      const g = nav[clave];
      const items: EnlaceMenu[] = [];
      for (const it of g?.items ?? []) {
        const href = (it.href as unknown as Record<Lang, string>)[lang];
        const id = idPublicableDeRuta((it.href as unknown as Record<Lang, string>).es);
        if (!id || !href) continue;
        const t = proyectarArbol(it.t, lang) as string;
        const d = it.d ? (proyectarArbol(it.d, lang) as string) : '';
        items.push({id, titulo: t, texto: d, href});
      }
      const idx = indices[clave];
      return {clave, etiqueta: proyectarArbol(g.etiqueta, lang) as string, indice: idx && esPublicable(idx) ? hrefDe(idx, lang) : null, items};
    })
    .filter((g) => g.items.length > 0);
}

export type ColumnaPie = {titulo: string; items: {titulo: string; href: string}[]};

/** Columnas del pie: solo enlaces a páginas publicables del registro. Enlaces fuera del registro (por ejemplo security.txt) no se emiten. */
export function columnasPie(lang: Lang): ColumnaPie[] {
  const pie = publicar(LANDING.pie, {aprobaciones: APROB, ctx: CTX, prefijo: 'pie'}).arbol as unknown as {columnas: {t: Bi; items: ItemNav[]}[]};
  return pie.columnas
    .map((c) => ({
      titulo: proyectarArbol(c.t, lang) as string,
      items: c.items
        .filter((it) => idPublicableDeRuta((it.href as unknown as Record<Lang, string>).es) !== null)
        .map((it) => ({titulo: proyectarArbol(it.t, lang) as string, href: (it.href as unknown as Record<Lang, string>)[lang]})),
    }))
    .filter((c) => c.items.length > 0);
}

/** Líneas legales del pie que sí se publican: la línea de marca y, solo con razón social y fecha resueltas, derechos y revisión. */
export function lineasPie(lang: Lang): {linea: string; derechos: string | null; revision: string | null} {
  const pie = publicar(LANDING.pie, {aprobaciones: APROB, ctx: CTX, prefijo: 'pie'}).arbol as unknown as {linea: Bi; derechos?: Bi; revision?: Bi};
  const t = (h?: Bi) => (h ? (proyectarArbol(h, lang) as string) : null);
  return {linea: t(pie.linea) ?? '', derechos: t(pie.derechos), revision: t(pie.revision)};
}

/** Textos fijos del shell en el idioma pedido. */
export function textosShell(lang: Lang) {
  const n = LANDING.nav;
  const p = (h: Bi) => proyectarArbol(h, lang) as string;
  return {
    saltar: p(n.saltar),
    cta: p(n.cta),
    idiomaAria: p(n.idiomaAria),
    menuAbrir: p(n.menuAbrir),
    menuCerrar: p(n.menuCerrar),
    principal: lang === 'es' ? 'Principal' : 'Main',
    inicio: lang === 'es' ? 'Rovaq AI, inicio' : 'Rovaq AI, home',
    pie: lang === 'es' ? 'Pie de página' : 'Footer',
    idioma: lang === 'es' ? 'Idioma' : 'Language',
  };
}

/** Enlace del botón Solicitar acceso: la página del registro si se publica; si no, el mailto del cierre con asunto y cuerpo. */
export function hrefAcceso(lang: Lang): string {
  if (esPublicable('solicitar-acceso')) return hrefDe('solicitar-acceso', lang);
  const c = LANDING.cierre;
  const p = (h: Bi) => proyectarArbol(h, lang) as string;
  return construirMailto({contacto: CTX.contacto ?? '', asunto: p(c.correoAsunto), cuerpo: p(c.correoCuerpo)}) ?? hrefDe('inicio', lang);
}

/** Contenido de una página por su id del registro (hoy, propietario, seguridad-y-privacidad...). */
export const paginaDe = (id: string): Pagina | undefined => PAGINA_DE_REGISTRO.get(id);
export {porId};

/** Página publicable detrás de un enlace de contenido (hoja bilingüe de rutas). Para filtrar enlaces de bloques. */
export const rutaPublicable = (href: Record<Lang, string>): boolean => idPublicableDeRuta(href.es) !== null;

/** Mailto del correo de solicitud de acceso (asunto y cuerpo del cierre), o null sin contacto resuelto. */
export function hrefMailto(lang: Lang): string | null {
  const c = LANDING.cierre;
  const p = (h: Bi) => proyectarArbol(h, lang) as string;
  return construirMailto({contacto: CTX.contacto ?? '', asunto: p(c.correoAsunto), cuerpo: p(c.correoCuerpo)});
}

/** Cierre de las páginas internas: título, texto y precio ya publicados (sin marcadores). */
export function cierre(lang: Lang): {titulo: string; texto: string; precio: string} {
  const c = publicar(LANDING.cierre, {aprobaciones: APROB, ctx: CTX, prefijo: 'cierre'}).arbol as unknown as Record<'titulo' | 'texto' | 'precio', Bi>;
  const p = (h: Bi) => proyectarArbol(h, lang) as string;
  return {titulo: p(c.titulo), texto: p(c.texto), precio: p(c.precio)};
}

/** Árbol de una página ya publicable (marcadores resueltos, alternos aplicados, lo no publicable omitido), aún bilingüe. */
export function paginaPublicada(pagina: Pagina) {
  return publicar(pagina, {aprobaciones: APROB, ctx: CTX, prefijo: `paginas.${pagina.id}`}).arbol as unknown as PaginaPublicada;
}

export type HojaPub = {es: string; en: string; nivel?: 'PUBLICO' | 'MATIZ'; condicion?: {n: number; texto?: string; acompana?: readonly string[]}};
export type PaginaPublicada = {
  id: string;
  estado: string;
  pendiente?: string;
  h1: HojaPub;
  subtitulo: HojaPub;
  bloques: Record<string, unknown>[];
  cta?: HojaPub;
  rotulo?: HojaPub;
};
