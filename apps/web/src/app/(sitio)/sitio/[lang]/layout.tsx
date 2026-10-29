// Raíz del sitio público (rovaq.ai): su propio <html> con lang estático por idioma, sin cookies ni encabezados.
// Todo lo que cuelga de aquí se prerenderiza en el build; si alguien usa una API dinámica, el build falla en lugar de degradar.
// Orden de carga del CSS (contrato de T6): fuentes, tokens, base, tipografía, inicio, y al final las piezas de páginas internas.
import type {ReactNode} from 'react';
import {preload, preloadModule} from 'react-dom';
import {notFound} from 'next/navigation';
import '../../../../styles/sitio/fuentes.css';
import '../../../../styles/sitio/tokens.css';
import '../../../../styles/sitio/base.css';
import '../../../../styles/sitio/tipografia.css';
import '../../../../styles/sitio/inicio.css';
import '../../../../styles/sitio/movimiento.css';
import '../../../../styles/sitio/integracion.css';
import '../../../../components/sitio/shell/paginas.css';
import {esLang, IDIOMAS_VALIDOS} from '../../../../components/sitio/shell/datos';
import {fijarIdioma} from '../../../../components/sitio/shell/idioma-actual';
import {textosPortada} from '../../../../components/sitio/secciones/datos';
import {existe, precargas, url} from '../../../../lib/sitio/activos';
import {viewportSitio} from '../../../../components/sitio/shell/metadatos';

/** Color de la barra del navegador, claro y oscuro (T2). */
export const viewport = viewportSitio;
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return IDIOMAS_VALIDOS.map((lang) => ({lang}));
}

export default async function RaizSitio({children, params}: {children: ReactNode; params: Promise<{lang: string}>}) {
  const {lang} = await params;
  if (!esLang(lang)) notFound();
  fijarIdioma(lang);
  // Un solo script de módulo por página (sitio.js); inicio.js, nube.js y Lenis se piden tras reposo con las URL de estos atributos.
  const sitio = existe('sitio.js') ? url('sitio.js') : null;
  for (const f of precargas()) preload(f.url, {as: 'font', type: f.type, crossOrigin: 'anonymous'});
  if (sitio) preloadModule(sitio, {as: 'script'});
  const datos: Record<string, string> = {};
  if (existe('inicio.js')) datos['data-inicio'] = url('inicio.js');
  if (existe('nube.js')) datos['data-nube'] = url('nube.js');
  if (existe('lenis.js')) datos['data-lenis'] = url('lenis.js');
  const orbes: Record<string, string> = {};
  if (existe('img/o1-orbe')) orbes.o1 = url('img/o1-orbe', {ancho: 192});
  if (existe('img/hero-orbe')) orbes.hero = url('img/hero-orbe', {ancho: 192});
  datos['data-orbes'] = JSON.stringify(orbes);
  datos['data-notas'] = JSON.stringify((textosPortada(lang) as unknown as {hilo?: {notas?: string[]}}).hilo?.notas ?? []);
  return (
    <html lang={lang}>
      {/* El módulo va en <head> con blocking="render": en visitas repetidas fija data-intro-visto antes del primer pintado y el cargador no parpadea (Chromium; en los demás motores se ignora y todo sigue igual). Es deferido, así que no bloquea el análisis del HTML. */}
      <head>{sitio ? <script type="module" src={sitio} data-sitio="" {...({blocking: 'render'} as Record<string, string>)} {...datos} /> : null}</head>
      <body>
        {children}
      </body>
    </html>
  );
}
