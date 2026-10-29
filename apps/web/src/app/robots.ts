import type {MetadataRoute} from 'next';
import {headers} from 'next/headers';
import {landingUrl} from '../lib/site.mjs';
import {robotsParaHost} from '../../config/sitio/agentic.mjs';
/**
 * robots.txt por host (decisión y lista de rastreadores en config/sitio/agentic.mjs).
 * rovaq.ai: contenido público abierto a buscadores y agentes de IA, con política explícita por rastreador; se cierra solo lo interno (/sitio/, /api/, /_next/data/). Los activos de /s/ quedan abiertos para que Google cargue scripts e imágenes.
 * app.rovaq.ai y cualquier otro host (vistas previas, hosts antiguos): Disallow: / y sin sitemap. El noindex por segmento y la cabecera X-Robots-Tag son la segunda barrera.
 */
export default async function robots():Promise<MetadataRoute.Robots>{
 const h=await headers();
 return robotsParaHost(h.get('x-forwarded-host')??h.get('host'),landingUrl());
}
