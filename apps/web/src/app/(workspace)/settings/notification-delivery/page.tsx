import Link from 'next/link';
import {workspaceSession} from '../../../../lib/workspace/server';
import {DeliveryPolicies} from '../../../../components/notifications/delivery-policies';
export default async function Page(){
 const {session}=await workspaceSession();
 if(session.active.role!=='owner')return <section><h1>Política de envío</h1><p>Sólo una persona propietaria puede configurar los envíos de la organización.</p><Link href="/settings/notifications">Mis preferencias</Link></section>;
 return <DeliveryPolicies key={session.user.id+':'+session.active.tenant_id}/>;
}
