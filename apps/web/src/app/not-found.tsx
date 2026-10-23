import Link from 'next/link';
import {ThemeBoot} from '../components/theme-boot';
export const metadata={title:'Página no encontrada'};
export default function NotFound(){return <section className="access-flow"><ThemeBoot/><p className="eyebrow">Rovaq AI · 404</p><h1>No encontramos esta página</h1><p>El enlace puede haber cambiado. Vuelve a tu espacio de trabajo para abrir un recurso disponible con tu acceso.</p><div className="btn-group"><Link className="btn btn-primary" href="/overview">Ir al resumen</Link></div></section>;}
