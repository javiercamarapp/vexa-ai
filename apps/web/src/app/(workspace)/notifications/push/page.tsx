import {PushPreferences} from '../../../../components/notifications/push-preferences';
import {workspaceSession} from '../../../../lib/workspace/server';
import {conRedireccionDeAcceso} from '../../../../lib/workspace/acceso-pagina';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.notifications-push-device',{manifest:'/push-manifest.webmanifest'});
export default async function Page(){const {session}=await conRedireccionDeAcceso(workspaceSession);return <PushPreferences key={session.user.id+':'+session.active.tenant_id}/>;}
