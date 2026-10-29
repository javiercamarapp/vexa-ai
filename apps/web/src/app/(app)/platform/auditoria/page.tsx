import {AuditLog} from '../../../../components/platform/platform-views';
import {EventosSeguridad} from '../../../../components/platform/eventos-seguridad';
import {loadPlatform, platformAccessForPage} from '../_lib/access';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.platform-auditoria');
export const dynamic = 'force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const access = await platformAccessForPage();
  return <><AuditLog initial={access ? await loadPlatform(access) : {status: 'denied'}} /><EventosSeguridad access={access} searchParams={await searchParams} /></>;
}
