// Ayudante de secciones.test.mjs (no es una prueba): renderiza la Portada dentro del marco de T7, en los dos idiomas, con react-dom/server
// y escribe JSON en stdout con el HTML de cada caso. Se ejecuta con `node --import tsx --import ./_css-nulo.mjs`.
import {renderToStaticMarkup} from 'react-dom/server';
import {MarcoSitio} from '../../src/components/sitio/shell/marco';
import {Portada} from '../../src/components/sitio/secciones/portada';
import {metadatosPagina} from '../../src/components/sitio/shell/metadatos';
import {textosPortada} from '../../src/components/sitio/secciones/datos';
import {PAGINAS, rutaDe} from '../../src/content/sitio/registro.mjs';
import {esPublicable} from '../../src/components/sitio/shell/datos';

const salida: Record<string, unknown> = {};
for (const lang of ['es', 'en'] as const) {
  const meta = metadatosPagina({id: 'inicio', lang, titulo: 'x', descripcion: 'y'});
  const canonical = meta.alternates?.canonical as string;
  const cuerpo = renderToStaticMarkup(<MarcoSitio lang={lang} id="inicio"><Portada lang={lang} /></MarcoSitio>);
  salida[lang] = {
    html: `<!doctype html><html lang="${lang}"><head><link rel="canonical" href="${canonical}"></head><body>${cuerpo}</body></html>`,
    portada: renderToStaticMarkup(<Portada lang={lang} />),
    textos: textosPortada(lang),
  };
}
// Rutas internas que el registro K2 publica hoy, en los dos idiomas: los enlaces de la portada deben caer aquí.
salida.rutasPublicables = PAGINAS.filter((p) => esPublicable(p.id)).flatMap((p) => [rutaDe(p.id, 'es'), rutaDe(p.id, 'en')]);
process.stdout.write(JSON.stringify(salida));
