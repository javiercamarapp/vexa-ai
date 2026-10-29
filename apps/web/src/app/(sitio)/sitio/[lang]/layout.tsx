// Raíz del sitio público (rovaq.ai): su propio <html> con lang estático por idioma, sin cookies ni encabezados.
// Todo lo que cuelga de aquí se prerenderiza en el build; si alguien usa una API dinámica, el build falla en lugar de degradar.
// Orden de carga del CSS (contrato de T6): fuentes, tokens, base, tipografía, inicio, y al final las piezas de páginas internas.
import type {ReactNode} from 'react';
import {notFound} from 'next/navigation';
import '../../../../styles/sitio/fuentes.css';
import '../../../../styles/sitio/tokens.css';
import '../../../../styles/sitio/base.css';
import '../../../../styles/sitio/tipografia.css';
import '../../../../styles/sitio/inicio.css';
import '../../../../components/sitio/shell/paginas.css';
import {esLang, IDIOMAS_VALIDOS} from '../../../../components/sitio/shell/datos';
import {fijarIdioma} from '../../../../components/sitio/shell/idioma-actual';
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
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
