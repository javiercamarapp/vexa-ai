'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {WorkspaceIcon} from '../workspace/icon';
const ITEMS: ReadonlyArray<readonly [string, string, string]> = [['/platform', 'Resumen', 'overview'], ['/platform/organizaciones', 'Organizaciones', 'team'], ['/platform/fuentes', 'Fuentes y cargas', 'imports'], ['/platform/procesos', 'Procesos', 'analysis'], ['/platform/costos-ia', 'Costos de IA', 'economics'], ['/platform/alertas', 'Alertas', 'problems'], ['/platform/auditoria', 'Auditoría', 'history'], ['/seguridad', 'Seguridad de la cuenta', 'settings']];
export const platformTitle = (path: string) => [...ITEMS].sort((a, b) => b[0].length - a[0].length).find(([h]) => path === h || path.startsWith(h + '/'))?.[1] ?? 'Plataforma';
export function PlatformNav() {
  const path = usePathname();
  return <nav className="sidebar-navigation" aria-label="Administración de plataforma"><p className="nav-caption">Gestionar</p><ul>
    {ITEMS.map(([href, label, icon]) => <li key={href}><Link prefetch={false} href={href} aria-current={path === href ? 'page' : undefined}><WorkspaceIcon name={icon} />{label}</Link></li>)}
  </ul></nav>;
}
