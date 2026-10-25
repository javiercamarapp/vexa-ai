import type {MetadataRoute} from 'next';
import {PREFIJOS_PRIVADOS,RUTAS_PUBLICAS,siteUrl} from '../lib/site.mjs';
/** Se permite lo público y se cierra el resto (la app es privada). El noindex de cada segmento y la cabecera X-Robots-Tag son la segunda barrera. */
export default function robots():MetadataRoute.Robots{
 const base=siteUrl();
 return {rules:[{userAgent:'*',allow:['/',...RUTAS_PUBLICAS],disallow:PREFIJOS_PRIVADOS.map(p=>p+(p==='/api'||p==='/auth'?'/':''))}],sitemap:`${base}/sitemap.xml`};
}
