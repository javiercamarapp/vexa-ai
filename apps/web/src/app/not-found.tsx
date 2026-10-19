import Link from 'next/link';
export const metadata={title:'Página no encontrada'};
export default function NotFound(){return <section className="access-flow"><p className="eyebrow">Rovaq AI · 404</p><h1>No encontramos esta página</h1><p>El enlace puede haber cambiado. Vuelve a tu espacio de trabajo para abrir un recurso disponible con tu acceso.</p><div className="btn-group"><Link className="btn btn-primary" href="/overview">Ir al resumen</Link><Link className="btn btn-secondary" href="/login">Iniciar sesión con otra cuenta</Link></div></section>;}
