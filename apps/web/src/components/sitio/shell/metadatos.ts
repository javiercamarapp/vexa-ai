// Metadatos mínimos de las páginas del sitio (T7): título, descripción, canonical absoluto y hreflang entre idiomas, con las rutas del registro.
// TODO-T2: lib/sitio/metadatos.mjs (T2) sustituirá esto con Open Graph, JSON-LD y estado de aprobación; las firmas se mantienen.
import type {Metadata} from 'next';
import {landingUrl} from '../../../lib/site.mjs';
import {hrefDe} from './datos';
import type {Lang} from './datos';

export function metadatosPagina({id, lang, titulo, descripcion, indexable = true}: {id: string; lang: Lang; titulo: string; descripcion: string; indexable?: boolean}): Metadata {
  const base = landingUrl();
  const abs = (ruta: string) => new URL(ruta, base).toString();
  return {
    title: {absolute: titulo},
    description: descripcion,
    alternates: {
      canonical: abs(hrefDe(id, lang)),
      languages: {es: abs(hrefDe(id, 'es')), en: abs(hrefDe(id, 'en')), 'x-default': abs(hrefDe(id, 'es'))},
    },
    robots: indexable ? {index: true, follow: true} : {index: false, follow: true},
  };
}
