import type {MetadataRoute} from 'next';
import {headers} from 'next/headers';
import {landingUrl} from '../lib/site.mjs';
import {ES_HOST_LANDING} from '../lib/host-routing.mjs';
import {entradasSitemap} from '../lib/sitio/metadatos.mjs';
import {fichasSitio} from '../components/sitio/shell/metadatos';
/**
 * rovaq.ai: una entrada por página publicable y por idioma, con alternates es-MX, en y x-default; las páginas pendientes de revisión o de condiciones no entran.
 * lastModified es la fecha real del contenido (config/sitio/fechas.json, calculada desde git por tools/sitio/generar-md.mjs --fechas), nunca la de la petición ni la del build.
 * app.rovaq.ai y los demás hosts: sin sitemap (su robots.txt cierra todo).
 */
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const h=await headers();
 if(!ES_HOST_LANDING(h.get('x-forwarded-host')??h.get('host')))return [];
 return entradasSitemap(fichasSitio(),landingUrl());
}
