import Link from 'next/link';
import {workspaceSession} from '../../../../lib/workspace/server';
import {DeliveryPolicies} from '../../../../components/notifications/delivery-policies';
export const metadata={title:'Entrega de avisos'};
// Auditoría local explícita, igual que Preferencias de avisos; nunca en producción.
const FIXTURES=process.env.NODE_ENV==='development'&&process.env.VEXA_UI_FIXTURES==='1';
export default async function Page(){
 const access=FIXTURES?{role:process.env.VEXA_UI_FIXTURES_ROLE??'owner',key:'fixture'}:await workspaceSession().then(({session})=>({role:session.active.role,key:session.user.id+':'+session.active.tenant_id}));
 if(access.role!=='owner')return <section><h1>Política de envío</h1><p>Sólo una persona propietaria puede configurar los envíos de la organización.</p><Link prefetch={false} href="/settings/notifications">Mis preferencias</Link></section>;
 return <DeliveryPolicies key={access.key}/>;
}
