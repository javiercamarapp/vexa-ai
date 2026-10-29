import {Alerts} from '../../../../components/platform/platform-views';
import {AlertasSeguridad} from '../../../../components/platform/eventos-seguridad';
import {loadPlatform, platformAccessForPage} from '../_lib/access';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.platform-alertas');
export const dynamic = 'force-dynamic';
export default async function Page() {
  const access = await platformAccessForPage();
  return <><AlertasSeguridad access={access} /><Alerts initial={access ? await loadPlatform(access) : {status: 'denied'}} /></>;
}
