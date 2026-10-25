import {NotificationPanel} from '../../../../components/notifications/panel';
import {workspaceSession} from '../../../../lib/workspace/server';
import {conRedireccionDeAcceso} from '../../../../lib/workspace/acceso-pagina';
export const metadata={title:'Preferencias de avisos'};
// Solo `next dev` con VEXA_UI_FIXTURES=1 (auditoría visual local): sin Supabase.
const FIXTURES=process.env.NODE_ENV==='development'&&process.env.VEXA_UI_FIXTURES==='1';
export default async function Page(){const key=FIXTURES?'fixture':await conRedireccionDeAcceso(workspaceSession).then(({session})=>session.user.id+':'+session.active.tenant_id);return <NotificationPanel key={key} settings/>;}
