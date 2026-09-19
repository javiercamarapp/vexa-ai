import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AccessError } from '../../lib/auth';
import { workspaceSession } from '../../lib/workspace/server';
import { SessionGuard } from '../session-guard';
import { Navigation } from '../../components/workspace/navigation';
import { DataState } from '../../components/workspace/data-state';
export const dynamic='force-dynamic';
export default async function WorkspaceLayout({children}:{children:ReactNode}){
 let context;try{context=await workspaceSession();}catch(error){if(error instanceof AccessError&&[401,403].includes(error.status))redirect('/login?error=access_denied');return <DataState state={{kind:'error',code:'workspace_identity_unavailable',message:'Configura el acceso Supabase y verifica el servicio de identidad para abrir el espacio de trabajo.'}}/>;}
 const {session,client}=context;const {data:organizations,error}=await client.from('organizations').select('id,name').in('id',session.memberships.map(m=>m.tenant_id)).order('name');
 if(error)return <DataState state={{kind:'error',code:'organizations_unavailable',message:'No se pudo verificar la organización. Reintenta cuando se restablezca el servicio.'}}/>;
 if(!organizations?.some(o=>o.id===session.active.tenant_id))redirect('/login?error=access_denied');
 return <div className="workspace"><SessionGuard/><aside className="workspace-sidebar"><p className="eyebrow">Decisiones con evidencia</p><Navigation/><form action="/auth/organization" method="post"><label htmlFor="workspace-org">Organización activa</label><select id="workspace-org" name="tenant_id" defaultValue={session.active.tenant_id}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button>Cambiar organización</button></form><p>Rol: {session.active.role}</p><form action="/auth/logout" method="post"><button>Cerrar sesión</button></form></aside><div className="workspace-content">{children}</div></div>;
}
