// Ayudante de shell.test.mjs (no es una prueba: el prefijo _ lo deja fuera del glob). Se ejecuta con `node --import tsx` porque los
// componentes son TSX; renderiza el shell, el renderizador de bloques y el despachador con react-dom/server y escribe JSON en stdout.
import {renderToStaticMarkup} from 'react-dom/server';
import {PAGINAS} from '../../src/content/sitio/registro.mjs';
import {MarcoSitio} from '../../src/components/sitio/shell/marco';
import {CuerpoPagina} from '../../src/components/sitio/cuerpo';
import {LogoSitio} from '../../src/components/sitio/logo-sitio';
import {esPublicable, paginaDe, motivosNoPublicable, menus, columnasPie} from '../../src/components/sitio/shell/datos';
import {metadatosPagina} from '../../src/components/sitio/shell/metadatos';
import {Portada} from '../../src/components/sitio/secciones/portada';
import PaginaInterna, {generateStaticParams, generateMetadata} from '../../src/app/(sitio)/sitio/[lang]/[...ruta]/page';
import NoEncontrada from '../../src/app/(sitio)/sitio/[lang]/not-found';

type Lang = 'es' | 'en';
const doc = (lang: Lang, canonical: string | null, cuerpo: string) =>
  `<!doctype html><html lang="${lang}"><head>${canonical ? `<link rel="canonical" href="${canonical}">` : ''}</head><body>${cuerpo}</body></html>`;

async function main() {
const salida: Record<string, unknown> = {};
const casos: {nombre: string; lang: Lang; id: string | null; html: string; canonical: string | null}[] = [];

// 1. Despachador: se llama a la página como lo hace Next (async, con params) y se rinde el elemento.
const params = generateStaticParams();
salida.params = params;
let noPublicablesLanzan = 0;
const lanzados: string[] = [];
for (const p of params) {
  try {
    const el = await PaginaInterna({params: Promise.resolve({lang: p.lang, ruta: p.ruta})});
    const meta = await generateMetadata({params: Promise.resolve({lang: p.lang, ruta: p.ruta})});
    const pub = PAGINAS.find((x) => x[p.lang].ruta === (p.lang === 'en' ? '/en/' : '/') + p.ruta.join('/'));
    const canonical = (meta.alternates?.canonical as string) ?? null;
    const centinela = p.ruta.length === 1 && p.ruta[0] === '__404';
    casos.push({nombre: `${centinela ? 'centinela' : 'pagina'}:${p.lang}:${pub?.id}`, lang: p.lang, id: pub?.id ?? null, html: doc(p.lang, canonical, renderToStaticMarkup(el)), canonical});
  } catch (e) {
    const digest = (e as {digest?: string}).digest ?? '';
    if (digest.includes('404')) { noPublicablesLanzan++; lanzados.push(`${p.lang}:/${p.ruta.join('/')}`); } else throw e;
  }
}
salida.noPublicablesLanzan = noPublicablesLanzan;
salida.lanzados = lanzados;

// 2. Portada con el marco, en los dos idiomas.
for (const lang of ['es', 'en'] as const) {
  const meta = metadatosPagina({id: 'inicio', lang, titulo: 'x', descripcion: 'y'});
  casos.push({nombre: `inicio:${lang}`, lang, id: 'inicio', html: doc(lang, meta.alternates?.canonical as string, renderToStaticMarkup(<MarcoSitio lang={lang} id="inicio"><Portada lang={lang} /></MarcoSitio>)), canonical: meta.alternates?.canonical as string});
  salida[`meta:${lang}`] = JSON.parse(JSON.stringify(meta));
}

// 3. 404 (el idioma por React.cache solo existe dentro de un render de Next: aquí es es).
const nf = renderToStaticMarkup(<NoEncontrada />);
casos.push({nombre: '404:es', lang: 'es', id: null, html: doc('es', null, nf), canonical: null});

// 4. Página no publicable con la nota de revisión, y publicable sin nota.
const seg = paginaDe('seguridad-y-privacidad')!;
salida.notaPendiente = renderToStaticMarkup(<CuerpoPagina pagina={seg} lang="es" publicable={false} motivos={motivosNoPublicable('seguridad-y-privacidad')} />);
salida.sinNota = renderToStaticMarkup(<CuerpoPagina pagina={paginaDe('hoy')!} lang="es" />);

// 5. Logo.
salida.logos = {
  auto: renderToStaticMarkup(<LogoSitio />),
  doble: renderToStaticMarkup(<LogoSitio tono="doble" etiqueta="" />),
  neg: renderToStaticMarkup(<LogoSitio tono="negativo" variante="simbolo" />),
  pos: renderToStaticMarkup(<LogoSitio tono="positivo" />),
  pie: renderToStaticMarkup(<LogoSitio variante="pie" />),
};

// 6. Estado de publicación y menús.
salida.estados = Object.fromEntries(PAGINAS.map((p) => [p.id, esPublicable(p.id)]));
salida.menus = {es: menus('es'), en: menus('en')};
salida.pie = {es: columnasPie('es'), en: columnasPie('en')};
salida.casos = casos;
process.stdout.write(JSON.stringify(salida));
}
main().catch((e) => { console.error(e); process.exit(1); });
