// Portada del sitio, por idioma (/sitio/es y /sitio/en; host-routing reescribe / y /en). La estructura S1 a S10 la pone Portada (T8).
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {LANDING} from '../../../../content/sitio/landing';
import {MarcoSitio} from '../../../../components/sitio/shell/marco';
import {esLang} from '../../../../components/sitio/shell/datos';
import {metadatosPagina} from '../../../../components/sitio/shell/metadatos';
import {Portada} from '../../../../components/sitio/secciones/portada';

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateMetadata({params}: {params: Promise<{lang: string}>}): Promise<Metadata> {
  const {lang} = await params;
  if (!esLang(lang)) return {};
  const s = LANDING.seo.pagina;
  return metadatosPagina({id: 'inicio', lang, titulo: s.titulo[lang], descripcion: s.descripcion[lang]});
}

export default async function Inicio({params}: {params: Promise<{lang: string}>}) {
  const {lang} = await params;
  if (!esLang(lang)) notFound();
  return (
    <MarcoSitio lang={lang} id="inicio">
      <Portada lang={lang} />
    </MarcoSitio>
  );
}
