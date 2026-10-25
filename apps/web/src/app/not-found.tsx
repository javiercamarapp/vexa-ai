import Link from 'next/link';
import {ThemeBoot} from '../components/theme-boot';
import {ROBOTS_PRIVADO} from '../lib/site.mjs';
export const metadata={title:'Página no encontrada',robots:ROBOTS_PRIVADO};
export default function NotFound(){return <section className="access-flow"><ThemeBoot/><p className="eyebrow">Rovaq AI · 404</p><h1>No encontramos esta página</h1><p>El enlace puede haber cambiado. Vuelve a Hoy para abrir un recurso disponible con tu acceso.</p><div className="btn-group"><Link prefetch={false} className="btn btn-primary" href="/overview">Ir a Hoy</Link></div></section>;}
