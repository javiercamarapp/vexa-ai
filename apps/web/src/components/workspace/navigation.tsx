 'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
export const destinations=[['/overview','Resumen'],['/problems','Problemas'],['/recommendations','Recomendaciones'],['/explorer','Explorador'],['/interventions','Intervenciones'],['/briefs','Brief ejecutivo']] as const;
export function Navigation(){const pathname=usePathname(),query=new URLSearchParams(useSearchParams().toString());query.delete('cursor');return <><nav aria-label="Espacio de trabajo"><ul>{destinations.map(([href,label])=><li key={href}><Link aria-current={pathname===href||pathname.startsWith(href+'/')?'page':undefined} href={href+'?'+query}>{label}</Link></li>)}</ul><p className="muted">Las fichas de problema y cliente se abren desde sus registros autorizados.</p></nav><nav aria-label="Gestión"><ul><li><Link aria-current={pathname==='/imports'||pathname.startsWith('/imports/')?'page':undefined} href={'/imports?'+query}>Importaciones</Link></li></ul></nav></>;}
