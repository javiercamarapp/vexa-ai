import type {MetadataRoute} from 'next';
import {RUTAS_PUBLICAS,siteUrl} from '../lib/site.mjs';
/** Solo URLs públicas que responden 200: «/» redirige (a /login sin sesión), así que no se lista. lastModified = fecha de build de esta ruta. */
const ACTUALIZADO=new Date();
export default function sitemap():MetadataRoute.Sitemap{
 const base=siteUrl();
 return RUTAS_PUBLICAS.map(ruta=>({url:`${base}${ruta}`,lastModified:ACTUALIZADO,changeFrequency:'monthly' as const,priority:1}));
}
