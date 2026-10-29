import type {MetadataRoute} from 'next';
import {headers} from 'next/headers';
import {RUTAS_PUBLICAS,landingUrl,siteUrl} from '../lib/site.mjs';
import {ES_HOST_LANDING} from '../lib/host-routing.mjs';
/** Solo URLs públicas que responden 200: en la app «/» redirige (a /login sin sesión), así que no se lista; en rovaq.ai la única URL es la landing. lastModified = fecha de build de esta ruta. */
const ACTUALIZADO=new Date();
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const h=await headers();
 if(ES_HOST_LANDING(h.get('x-forwarded-host')??h.get('host'))){const b=landingUrl(),alternates={languages:{'es-MX':`${b}/`,en:`${b}/en`,'x-default':`${b}/`}};return [`${b}/`,`${b}/en`].map(url=>({url,lastModified:ACTUALIZADO,changeFrequency:'monthly' as const,priority:1,alternates}));}
 const base=siteUrl();
 return RUTAS_PUBLICAS.map(ruta=>({url:`${base}${ruta}`,lastModified:ACTUALIZADO,changeFrequency:'monthly' as const,priority:1}));
}
