import {Organizations} from '../../../components/platform/platform-views';
import {loadPlatform, platformAccessForPage} from '../_lib/access';
export const metadata = {title: 'Organizaciones'};
export const dynamic = 'force-dynamic';
export default async function Page() {
  const access = await platformAccessForPage();
  return <Organizations initial={access ? await loadPlatform(access) : {status: 'denied'}} />;
}
