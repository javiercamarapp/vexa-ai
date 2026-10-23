import Link from 'next/link';
import type {ReactNode} from 'react';
import {RovaqLogo} from '../../components/rovaq-logo';
import {WorkspaceIcon} from '../../components/workspace/icon';
import {PlatformNav} from '../../components/platform/platform-nav';
import {platformAccessForPage} from './_lib/access';
import './platform.css';
export const dynamic = 'force-dynamic';
export default async function PlatformLayout({children}: {children: ReactNode}) {
  const access = await platformAccessForPage();
  if (!access) return <section className="home access-flow"><h1>Administración de plataforma</h1><p role="alert">No tienes acceso a la administración de plataforma.</p><Link prefetch={false} className="btn" href="/">Volver</Link></section>;
  return <div className="workspace workspace-shell platform-shell">
    <a className="skip-link workspace-skip" href="#platform-contenido">Saltar al contenido</a>
    <aside className="workspace-sidebar platform-sidebar" aria-label="Plataforma">
      <div className="sidebar-brand"><Link prefetch={false} href="/platform" className="sidebar-logo" aria-label="Rovaq, administración"><RovaqLogo variante="horizontal" ancho={112} espacioLibre={false} decorativo/></Link></div>
      <div className="workspace-context"><span>Consola de administración</span><strong>Plataforma</strong><small>Organizaciones, fuentes y costos</small></div>
      <PlatformNav />
      <div className="sidebar-footer">
        <Link prefetch={false} className="workspace-platform-link" href="/"><WorkspaceIcon name="overview" />Mi organización</Link>
        <div className="platform-account"><span className="account-avatar" aria-hidden="true">A</span><div className="account-copy"><strong>Administrador</strong><span>Acceso de plataforma</span></div></div>
        <form action="/auth/logout" method="post"><button className="platform-logout" type="submit"><WorkspaceIcon name="logout" />Cerrar sesión</button></form>
      </div>
    </aside>
    <div className="workspace-frame"><header className="workspace-header"><span className="workspace-heading"><WorkspaceIcon name="settings" />Consola de Rovaq AI</span><span className="platform-scope">Administración</span></header><div className="workspace-content" id="platform-contenido" tabIndex={-1}>{children}</div></div>
  </div>;
}
