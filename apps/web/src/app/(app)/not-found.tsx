import Link from 'next/link';
import {ThemeBoot} from '../../components/theme-boot';
import {ROBOTS_PRIVADO} from '../../lib/site.mjs';
import {metaTitulo} from '../../lib/i18n/titulo';
import {traductor} from '../../lib/i18n';
import {idiomaActual} from '../../lib/i18n/servidor';
export const generateMetadata=()=>metaTitulo('meta.titulo.not-found',{robots:ROBOTS_PRIVADO});
export default async function NotFound(){const t=traductor(await idiomaActual());return <section className="access-flow"><ThemeBoot/><p className="eyebrow">Rovaq AI · 404</p><h1>{t('tr.nf.titulo')}</h1><p>{t('tr.nf.cuerpo')}</p><div className="btn-group"><Link prefetch={false} className="btn btn-primary" href="/overview">{t('det.irAHoy')}</Link></div></section>;}
