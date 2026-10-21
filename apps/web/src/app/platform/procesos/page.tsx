import {Jobs} from '../../../components/platform/platform-views';
import {loadPlatform, platformAccessForPage} from '../_lib/access';
export const metadata = {title: 'Procesos y colas'};
export const dynamic = 'force-dynamic';
export default async function Page() {
  const access = await platformAccessForPage();
  return <Jobs initial={access ? await loadPlatform(access) : {status: 'denied'}} />;
}
