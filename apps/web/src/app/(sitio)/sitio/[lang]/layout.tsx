// Raíz del sitio público (rovaq.ai): su propio <html> con lang estático por idioma, sin cookies ni encabezados.
// Todo lo que cuelga de aquí se prerenderiza en el build; si alguien usa una API dinámica, el build falla en lugar de degradar.
import type {ReactNode} from 'react';
import '../../../../styles/sitio/tokens.css';
import '../../../../styles/sitio/base.css';
import '../../../../styles/sitio/tipografia.css';

export const dynamic = 'force-static';
export const dynamicParams = false;
const IDIOMAS_SITIO = ['es', 'en'] as const;

export function generateStaticParams() {
  return IDIOMAS_SITIO.map((lang) => ({lang}));
}

export default async function RaizSitio({children, params}: {children: ReactNode; params: Promise<{lang: string}>}) {
  const {lang} = await params;
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
