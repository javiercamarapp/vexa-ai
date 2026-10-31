// Metadatos y datos estructurados de las páginas del sitio (T2). Adaptador fino entre Next y las funciones puras de lib/sitio/metadatos.mjs y jsonld.mjs:
// aquí solo se cargan el contenido, las aprobaciones, las fechas y el manifest; toda la lógica está en los .mjs, que también usan las pruebas y las herramientas.
import type {Metadata} from 'next';
import {LANDING} from '../../../content/sitio/landing';
import {PAGINAS_INTERNAS} from '../../../content/sitio/paginas/index';
import aprobaciones from '../../../content/sitio/aprobaciones.json';
import fechas from '../../../../config/sitio/fechas.json';
import {existe, url as urlActivo} from '../../../lib/sitio/activos';
import {construirFichas, metadatosSitio, rutaEspejo, viewportSitio as viewportBase} from '../../../lib/sitio/metadatos.mjs';
import type {FichaPagina, IdiomaSitio, ManifestMd} from '../../../lib/sitio/metadatos.mjs';
import {grafoDePagina, serializar} from '../../../lib/sitio/jsonld.mjs';

export const viewportSitio = viewportBase;

let cache: FichaPagina[] | null = null;
/** Fichas de todas las páginas del registro, calculadas una vez por proceso de build. */
export function fichasSitio(): FichaPagina[] {
  cache ??= construirFichas({landing: LANDING, paginas: PAGINAS_INTERNAS, aprobaciones, fechas});
  return cache;
}

/** sección md del manifest de activos como { 'es/hoy': { url } }, solo con lo que existe. */
export function manifestMd(): ManifestMd {
  const salida: ManifestMd = {};
  for (const f of fichasSitio()) {
    for (const lang of ['es', 'en'] as const) {
      const clave = `${lang}/${f.id}`;
      if (existe(`md/${clave}`)) salida[clave] = {url: urlActivo(`md/${clave}`)};
    }
  }
  return salida;
}

/** Misma firma que la versión provisional de T7: título, descripción y estado vienen de quien conoce la página. */
export function metadatosPagina({id, lang, titulo, descripcion, indexable = true, publicado = null, modificado = null}: {id: string; lang: IdiomaSitio; titulo: string; descripcion: string; indexable?: boolean; publicado?: string | null; modificado?: string | null}): Metadata {
  return metadatosSitio({id, lang, titulo, descripcion, indexable, espejo: rutaEspejo(id, lang, manifestMd()), publicado, modificado});
}

/** Texto del script ld+json de una página, ya serializado y con < escapado. */
export function jsonLdDe(id: string, lang: IdiomaSitio): string {
  const fichas = fichasSitio();
  const inicio = fichas.find((f) => f.id === 'inicio');
  const faq = id === 'inicio'
    ? ((inicio?.arbol as {faq?: {items?: {q: Record<IdiomaSitio, string>; a: Record<IdiomaSitio, string>}[]}})?.faq?.items ?? []).map((x) => ({q: x.q[lang], a: x.a[lang]}))
    : [];
  return serializar(grafoDePagina(id, lang, {fichas, faq}));
}
