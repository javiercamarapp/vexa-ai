import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AccessError } from '../../lib/auth';
import { workspaceSession } from '../../lib/workspace/server';
import { SessionGuard } from '../session-guard';
import { WorkspaceShell } from '../../components/workspace/shell';
import { VexaBrand } from '../../components/vexa-brand';
import { DataState } from '../../components/workspace/data-state';
export const dynamic='force-dynamic';
export default async function WorkspaceLayout({children}:{children:ReactNode}){
 let context;try{context=await workspaceSession();}catch(error){if(error instanceof AccessError&&[401,403].includes(error.status))redirect('/login?error=access_denied');return <DataState state={{kind:'error',code:'workspace_identity_unavailable',message:'Configura el acceso Supabase y verifica el servicio de identidad para abrir el espacio de trabajo.'}}/>;}
 const {session,client}=context;const {data:organizations,error}=await client.from('organizations').select('id,name').in('id',session.memberships.map(m=>m.tenant_id)).order('name');
 if(error)return <DataState state={{kind:'error',code:'organizations_unavailable',message:'No se pudo verificar la organización. Reintenta cuando se restablezca el servicio.'}}/>;
 if(!organizations?.some(o=>o.id===session.active.tenant_id))redirect('/login?error=access_denied');
 const now=new Date();const today={iso:now.toISOString().slice(0,10),label:new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(now)};
 return <><SessionGuard/><WorkspaceShell brand={<VexaBrand/>} organizations={organizations} tenant={session.active.tenant_id} role={session.active.role} today={today}>{children}</WorkspaceShell></>;
}
