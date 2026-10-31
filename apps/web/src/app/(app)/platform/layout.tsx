import Link from 'next/link';
import type {ReactNode} from 'react';
import {RovaqLogo} from '../../../components/rovaq-logo';
import {WorkspaceIcon} from '../../../components/workspace/icon';
import {PlatformNav} from '../../../components/platform/platform-nav';
import {Notice} from '../../../components/ui/notice';
import {AdminTools} from '../../../components/platform/admin-tools';
import {redirect} from 'next/navigation';
import {platformAccessForPage, platformMfaGate} from './_lib/access';
import './platform.css';
import {OnboardingRaiz} from '../../../components/onboarding/contexto';
import {GuiaBoton,GuiaPaneles} from '../../../components/onboarding/guia';
import {IdiomaLocal} from '../../../components/i18n/proveedor';
import {idiomaActual} from '../../../lib/i18n/servidor';
import {traductor} from '../../../lib/i18n';
import {ROBOTS_PRIVADO} from '../../../lib/site.mjs';
export const metadata = {robots: ROBOTS_PRIVADO};
export const dynamic = 'force-dynamic';
export default async function PlatformLayout({children}: {children: ReactNode}) {
  const idioma = await idiomaActual();
  const t = traductor(idioma);
  const access = await platformAccessForPage();
  if (!access) return <section className="home access-flow acceso-sistema"><h1>{t('tr.pf.accesoTitulo')}</h1><Notice tone="error">{t('tr.pf.sinAcceso')}</Notice><Link prefetch={false} className="btn" href="/">{t('tr.pf.volver')}</Link></section>;
  if (await platformMfaGate(access) !== 'ok') redirect('/seguridad?requerido=1');
  // El estado local de la guía de plataforma se aísla con «plataforma» como organización; la consola aún no está traducida entera, por eso solo la guía usa el idioma activo.
  return <IdiomaLocal idioma={idioma}><OnboardingRaiz datos={{pista: 'plataforma', userId: access.userId, tenantId: 'plataforma', organizacion: 'Rovaq', rolEtiqueta: t('tr.pf.plataforma')}}><div className="workspace workspace-shell platform-shell">
    <a className="skip-link workspace-skip" href="#platform-contenido">{t('tr.pf.saltar')}</a>
    <aside className="workspace-sidebar platform-sidebar" aria-label={t('tr.pf.plataforma')}>
      <div className="sidebar-brand"><Link prefetch={false} href="/platform" className="sidebar-logo" aria-label={t('tr.pf.brandAria')}><RovaqLogo variante="horizontal" ancho={112} espacioLibre={false} decorativo/></Link></div>
      <div className="workspace-context"><span>{t('tr.pf.consolaAdmin')}</span><strong>{t('tr.pf.plataforma')}</strong><small>{t('tr.pf.orgFuentesCostos')}</small></div>
      <PlatformNav />
      <div className="sidebar-footer">
        <Link prefetch={false} className="workspace-platform-link" href="/"><WorkspaceIcon name="overview" />{t('tr.pf.miOrg')}</Link>
        <div className="platform-account"><span className="monograma" aria-hidden="true">AD</span><div className="account-copy"><strong>{t('tr.pf.administrador')}</strong><span>{t('tr.pf.accesoPlat')}</span></div></div>
        <form action="/auth/logout" method="post"><button className="platform-logout" type="submit"><WorkspaceIcon name="logout" />{t('tr.pf.cerrarSesion')}</button></form>
      </div>
    </aside>
    <div className="workspace-frame"><header className="workspace-header"><span className="workspace-heading"><WorkspaceIcon name="settings" />{t('tr.pf.consolaRovaq')}</span><span className="platform-scope">{t('tr.pf.administracion')}</span><GuiaBoton /><AdminTools /></header><div className="workspace-content" id="platform-contenido" tabIndex={-1}>{children}</div></div>
    <GuiaPaneles />
  </div></OnboardingRaiz></IdiomaLocal>;
}
