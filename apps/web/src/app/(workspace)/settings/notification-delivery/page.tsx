import Link from 'next/link';
import {workspaceSession} from '../../../../lib/workspace/server';
import {conRedireccionDeAcceso} from '../../../../lib/workspace/acceso-pagina';
import {idiomaActual} from '../../../../lib/i18n/servidor';
import {traductor} from '../../../../lib/i18n';
import {DeliveryPolicies} from '../../../../components/notifications/delivery-policies';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.settings-notification-delivery');
// Auditoría local explícita, igual que Preferencias de avisos; nunca en producción.
const FIXTURES=process.env.NODE_ENV==='development'&&process.env.VEXA_UI_FIXTURES==='1';
export default async function Page(){
 const access=FIXTURES?{role:process.env.VEXA_UI_FIXTURES_ROLE??'owner',key:'fixture'}:await conRedireccionDeAcceso(workspaceSession).then(({session})=>({role:session.active.role,key:session.user.id+':'+session.active.tenant_id}));
 if(access.role!=='owner'){const t=traductor(await idiomaActual());return <section><h1>{t('conx.p.titulo')}</h1><p>{t('conx.n.soloProp')}</p><Link prefetch={false} href="/settings/notifications">{t('conx.p.misPref')}</Link></section>;}
 return <DeliveryPolicies key={access.key}/>;
}
