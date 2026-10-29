// Despachador del sitio (T7). Resuelve la ruta con el registro K2 (idDeRuta) y rinde la página interna con el shell y el renderizador de bloques.
// Estático: generateStaticParams cubre las 33 páginas internas del registro por idioma (la portada es page.tsx) más un centinela __404.
// Regla (spec 5): una página sin contenido escrito o no publicable (estadoPagina de T11) devuelve el 404 propio del sitio, idéntico al de una
// ruta desconocida, sin revelar que existe. La nota de revisión vive en CuerpoPagina para la revisión interna; aquí no se emite.
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {PAGINAS, idDeRuta} from '../../../../../content/sitio/registro.mjs';
import {CuerpoPagina} from '../../../../../components/sitio/cuerpo';
import {MarcoSitio} from '../../../../../components/sitio/shell/marco';
import {esLang, esPublicable, paginaDe} from '../../../../../components/sitio/shell/datos';
import type {Lang} from '../../../../../components/sitio/shell/datos';
import {metadatosPagina} from '../../../../../components/sitio/shell/metadatos';
import {JsonLd} from '../../../../../components/sitio/shell/jsonld';

export const dynamic = 'force-static';
export const dynamicParams = false;

/** Segmento centinela al que host-routing reescribe las rutas desconocidas (ver SEGMENTO_404 en host-routing.mjs). */
const CENTINELA = '__404';

/** Segmentos internos de la ruta pública: /producto/hoy es ['producto','hoy']; /en/product/today, bajo /sitio/en, es ['product','today']. */
function segmentos(ruta: string, lang: Lang): string[] {
  const sinPrefijo = lang === 'en' ? ruta.replace(/^\/en(?=\/|$)/, '') : ruta;
  return sinPrefijo.split('/').filter(Boolean);
}

export function generateStaticParams() {
  const params: {lang: Lang; ruta: string[]}[] = [];
  for (const lang of ['es', 'en'] as const) {
    for (const p of PAGINAS) {
      if (p.id === 'inicio') continue;
      params.push({lang, ruta: segmentos(p[lang].ruta, lang)});
    }
    params.push({lang, ruta: [CENTINELA]});
  }
  return params;
}

/** Id de una página publicable para esta petición, o null (desconocida, sin contenido o no publicable). */
function resolver(lang: string, ruta: string[]): string | null {
  if (!esLang(lang)) return null;
  const publica = (lang === 'en' ? '/en/' : '/') + ruta.join('/');
  const r = idDeRuta(publica);
  if (!r || r.lang !== lang || r.id === 'inicio') return null;
  return esPublicable(r.id) && paginaDe(r.id) ? r.id : null;
}

export async function generateMetadata({params}: {params: Promise<{lang: string; ruta: string[]}>}): Promise<Metadata> {
  const {lang, ruta} = await params;
  const id = resolver(lang, ruta);
  const pagina = id ? paginaDe(id) : undefined;
  if (!id || !pagina || !esLang(lang)) return {};
  return metadatosPagina({id, lang, titulo: pagina.seo.titulo[lang], descripcion: pagina.seo.descripcion[lang]});
}

export default async function PaginaInterna({params}: {params: Promise<{lang: string; ruta: string[]}>}) {
  const {lang, ruta} = await params;
  const id = resolver(lang, ruta);
  const pagina = id ? paginaDe(id) : undefined;
  if (!id || !pagina || !esLang(lang)) notFound();
  return (
    <>
      <JsonLd id={id} lang={lang} />
      <MarcoSitio lang={lang} id={id}>
        <CuerpoPagina pagina={pagina} lang={lang} />
      </MarcoSitio>
    </>
  );
}
