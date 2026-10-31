// Despachador del sitio (T7). Resuelve la ruta con el registro K2 (idDeRuta) y rinde la página interna con el shell y el renderizador de bloques.
// Estático: generateStaticParams cubre las 33 páginas internas del registro por idioma (la portada es page.tsx) más un centinela __404.
// Los artículos del blog (tipo articulo del registro) se rinden con CuerpoArticulo; el resto, con CuerpoPagina.
// Regla (spec 5): una página sin contenido escrito o no publicable (estadoPagina de T11) devuelve el 404 propio del sitio, idéntico al de una
// ruta desconocida, sin revelar que existe. La nota de revisión vive en CuerpoPagina para la revisión interna; aquí no se emite.
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {PAGINAS, idDeRuta, porId} from '../../../../../content/sitio/registro.mjs';
import {CuerpoPagina} from '../../../../../components/sitio/cuerpo';
import {CuerpoArticulo} from '../../../../../components/sitio/articulo';
import type {Articulo} from '../../../../../content/sitio/tipos';
import {MarcoSitio} from '../../../../../components/sitio/shell/marco';
import {esLang, esPublicable, paginaDe} from '../../../../../components/sitio/shell/datos';
import type {Lang} from '../../../../../components/sitio/shell/datos';
import {metadatosPagina} from '../../../../../components/sitio/shell/metadatos';
import {JsonLd} from '../../../../../components/sitio/shell/jsonld';
import {landingUrl} from '../../../../../lib/site.mjs';
import {PaginaNoEncontrada} from '../../../../../components/sitio/shell/no-encontrada';

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
  if (ruta.length === 1 && ruta[0] === CENTINELA) return {metadataBase: new URL(landingUrl()), title: {absolute: 'Página no encontrada | Rovaq AI'}, robots: {index: false, follow: true}};
  const id = resolver(lang, ruta);
  const pagina = id ? paginaDe(id) : undefined;
  if (!id || !pagina || !esLang(lang)) return {};
  const art = porId(id)?.tipo === 'articulo' ? (pagina as Articulo) : null;
  return metadatosPagina({id, lang, titulo: pagina.seo.titulo[lang], descripcion: pagina.seo.descripcion[lang], ...(art ? {publicado: art.pub, modificado: art.mod ?? art.pub} : {})});
}

export default async function PaginaInterna({params}: {params: Promise<{lang: string; ruta: string[]}>}) {
  const {lang, ruta} = await params;
  // Centinela: página completa del 404 (no el notFound() de Next, cuyo HTML sin JavaScript es el cascarón de error sin lang ni h1). El middleware la sirve con estado 404.
  if (esLang(lang) && ruta.length === 1 && ruta[0] === CENTINELA) return <PaginaNoEncontrada lang={lang} />;
  const id = resolver(lang, ruta);
  const pagina = id ? paginaDe(id) : undefined;
  if (!id || !pagina || !esLang(lang)) notFound();
  return (
    <>
      <JsonLd id={id} lang={lang} />
      <MarcoSitio lang={lang} id={id}>
        {porId(id)?.tipo === 'articulo' ? <CuerpoArticulo pagina={pagina as Articulo} lang={lang} /> : <CuerpoPagina pagina={pagina} lang={lang} />}
      </MarcoSitio>
    </>
  );
}
