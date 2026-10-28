import type {MetadataRoute} from 'next';
import {headers} from 'next/headers';
import {PREFIJOS_PRIVADOS,RUTAS_PUBLICAS,landingUrl,siteUrl} from '../lib/site.mjs';
import {ES_HOST_LANDING} from '../lib/host-routing.mjs';
/** Se permite lo público y se cierra el resto (la app es privada). El noindex de cada segmento y la cabecera X-Robots-Tag son la segunda barrera. En rovaq.ai solo existe la landing: se permite y se anuncia su propio sitemap. */
export default async function robots():Promise<MetadataRoute.Robots>{
 const h=await headers();
 if(ES_HOST_LANDING(h.get('x-forwarded-host')??h.get('host')))return {rules:[{userAgent:'*',allow:['/']}],sitemap:`${landingUrl()}/sitemap.xml`};
 const base=siteUrl();
 return {rules:[{userAgent:'*',allow:['/',...RUTAS_PUBLICAS],disallow:PREFIJOS_PRIVADOS.map(p=>p+(p==='/api'||p==='/auth'?'/':''))}],sitemap:`${base}/sitemap.xml`};
}
