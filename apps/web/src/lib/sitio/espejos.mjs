// Espejos Markdown por ruta pública (T3). Une el registro de páginas con el manifest de /s/ para saber, dada una URL del sitio, qué archivo .md la espeja.
// Pura salvo por el manifest que se le entrega: el middleware lo importa del JSON generado en el build; las herramientas, de disco.
import {PAGINAS} from '../../content/sitio/registro.mjs';
import {ORIGEN_SITIO} from '../host-routing.mjs';

/** Misma regla que rutaEspejo de metadatos.mjs (copiada para no cargar el contenido en el middleware; una prueba las compara). */
export function rutaEspejoDe(id, lang, manifestMd = {}) {
  if (id === 'inicio') return lang === 'es' ? '/index.md' : '/en/index.md';
  return manifestMd[`${lang}/${id}`]?.url ?? null;
}
/** Mapa ruta pública -> {espejo, canonica}. Solo entran las páginas con espejo en el manifest (las publicables) más la portada. */
export function mapaEspejos(manifestMd = {}, base = ORIGEN_SITIO) {
  const mapa = new Map();
  for (const pag of PAGINAS) {
    for (const lang of ['es', 'en']) {
      const espejo = rutaEspejoDe(pag.id, lang, manifestMd);
      const ruta = pag[lang]?.ruta;
      if (espejo && ruta) mapa.set(ruta, {espejo, canonica: ruta === '/' ? base : base + ruta});
    }
  }
  return mapa;
}
/** Función espejoDe(rutaPublica) para decidirHost. */
export const espejoDeRuta = (mapa) => (ruta) => mapa.get(ruta)?.espejo ?? null;
