import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AccessError, SUPPORT_MARK } from '../../lib/auth';
import { supportMarkActive } from '../../lib/support-guard';
import { SupportBanner } from '../../components/platform/support-banner';
import { AdminTools } from '../../components/platform/admin-tools';
import { workspaceSession } from '../../lib/workspace/server';
import { SessionGuard } from '../session-guard';
import { WorkspaceShell } from '../../components/workspace/shell';
import { RovaqLogoLateral } from '../../components/rovaq-logo';
import { DataState } from '../../components/workspace/data-state';
export const dynamic='force-dynamic';
// Local visual QA only: `next dev` with VEXA_UI_FIXTURES=1 renders the real shell with a synthetic organization and no Supabase.
// Never active in a production build (NODE_ENV is "production" there), so it cannot widen access.
const UI_FIXTURES=process.env.NODE_ENV==='development'&&process.env.VEXA_UI_FIXTURES==='1';
export default async function WorkspaceLayout({children}:{children:ReactNode}){
 if(UI_FIXTURES){// Solo QA local: VEXA_UI_LAYOUT_DELAY_MS simula la latencia real de sesión/organizaciones del servidor (el HTML llega antes que el espacio de trabajo).
  const retraso=Number(process.env.VEXA_UI_LAYOUT_DELAY_MS??0);if(retraso>0)await new Promise(r=>setTimeout(r,retraso));
  const now=new Date();const mark=(await cookies()).get(SUPPORT_MARK)?.value;return <>{supportMarkActive(mark)&&<SupportBanner tenantId="00000000-0000-4000-8000-000000000002" tenantName="Cliente de ejemplo A (sintético)" reason="Demostración de modo soporte" expiresAt={new Date(Number(mark)*1000).toISOString()}/>}<WorkspaceShell brand={<RovaqLogoLateral/>} organizations={[{id:'00000000-0000-4000-8000-000000000001',name:'Organización de demostración (sintética)'},{id:'00000000-0000-4000-8000-000000000002',name:'Segunda empresa de demostración (sintética)'}]} tenant="00000000-0000-4000-8000-000000000001" role={process.env.VEXA_UI_FIXTURES_ROLE??'owner'} platformAccess={process.env.VEXA_UI_FIXTURES_PLATFORM==='1'} today={{iso:now.toISOString().slice(0,10),label:new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(now)}}>{children}</WorkspaceShell></>;}
 let context;try{context=await workspaceSession();}catch(error){if(error instanceof AccessError){if(error.status===401)redirect('/login');if(error.status===403)redirect('/sin-acceso');}return <DataState state={{kind:'error',code:'workspace_identity_unavailable',message:'Configura el acceso Supabase y verifica el servicio de identidad para abrir el espacio de trabajo.'}}/>;}
 const {session,client}=context;const {data:found,error}=await client.from('organizations').select('id,name').in('id',session.memberships.map(m=>m.tenant_id)).order('name');
 if(error)return <DataState state={{kind:'error',code:'organizations_unavailable',message:'No se pudo verificar la organización. Reintenta cuando se restablezca el servicio.'}}/>;
 // «Ver como»: la organización del cliente no está en las membresías del administrador; el nombre viene de la sesión de soporte que la base acaba de confirmar.
 const support=session.support;const organizations=[...(found??[])];
 if(support&&!organizations.some(o=>o.id===support.tenant_id))organizations.push({id:support.tenant_id,name:support.tenant_name??'Cliente'});
 if(!organizations.some(o=>o.id===session.active.tenant_id))redirect('/sin-acceso');
 const platform=await client.rpc('platform_manage',{p_input:{operation:'status'}});
 const platformAccess=!platform.error&&platform.data?.administrator===true;
 const now=new Date();const today={iso:now.toISOString().slice(0,10),label:new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(now)};
 return <>{support&&<SupportBanner tenantId={support.tenant_id} tenantName={support.tenant_name??'Cliente'} reason={support.reason} expiresAt={support.expires_at}/>}{platformAccess&&<AdminTools trigger={false}/>}<SessionGuard/><WorkspaceShell brand={<RovaqLogoLateral/>} organizations={organizations} tenant={session.active.tenant_id} role={session.active.role} platformAccess={platformAccess} today={today}>{children}</WorkspaceShell></>;
}
