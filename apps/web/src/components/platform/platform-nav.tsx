'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {WorkspaceIcon} from '../workspace/icon';
import {useT} from '../i18n/proveedor';
import type {Clave, Traductor} from '../../lib/i18n';
const ITEMS: ReadonlyArray<readonly [string, Clave, string]> = [['/platform', 'tr.pf.nResumen', 'overview'], ['/platform/organizaciones', 'tr.pf.nOrganizaciones', 'team'], ['/platform/fuentes', 'tr.pf.nFuentes', 'imports'], ['/platform/procesos', 'tr.pf.nProcesos', 'analysis'], ['/platform/costos-ia', 'tr.pf.nCostosIa', 'economics'], ['/platform/alertas', 'tr.pf.nAlertas', 'problems'], ['/platform/auditoria', 'tr.pf.nAuditoria', 'history'], ['/seguridad', 'tr.pf.nSeguridad', 'settings']];
export const platformTitle = (path: string, t: Traductor) => t([...ITEMS].sort((a, b) => b[0].length - a[0].length).find(([h]) => path === h || path.startsWith(h + '/'))?.[1] ?? 'tr.pf.plataforma');
export function PlatformNav() {
  const path = usePathname();
  const t = useT();
  return <nav className="sidebar-navigation" aria-label={t('tr.pf.accesoTitulo')}><p className="nav-caption">{t('tr.pf.gestionar')}</p><ul>
    {ITEMS.map(([href, label, icon]) => <li key={href}><Link prefetch={false} href={href} data-tour={'plataforma:'+href} aria-current={path === href ? 'page' : undefined}><WorkspaceIcon name={icon} />{t(label)}</Link></li>)}
  </ul></nav>;
}
