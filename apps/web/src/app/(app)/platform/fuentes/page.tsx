import {Sources} from '../../../../components/platform/platform-views';
import {loadPlatform, platformAccessForPage} from '../_lib/access';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.platform-fuentes');
export const dynamic = 'force-dynamic';
export default async function Page() {
  const access = await platformAccessForPage();
  return <Sources initial={access ? await loadPlatform(access) : {status: 'denied'}} />;
}
