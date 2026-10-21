import {Overview} from '../../components/platform/platform-views';
import {loadPlatform, platformAccessForPage} from './_lib/access';
export const metadata = {title: 'Resumen de plataforma'};
export const dynamic = 'force-dynamic';
export default async function Page() {
  const access = await platformAccessForPage();
  return <Overview initial={access ? await loadPlatform(access) : {status: 'denied'}} />;
}
