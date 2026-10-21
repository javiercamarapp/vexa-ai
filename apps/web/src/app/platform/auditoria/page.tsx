import {AuditLog} from '../../../components/platform/platform-views';
import {loadPlatform, platformAccessForPage} from '../_lib/access';
export const metadata = {title: 'Auditoría'};
export const dynamic = 'force-dynamic';
export default async function Page() {
  const access = await platformAccessForPage();
  return <AuditLog initial={access ? await loadPlatform(access) : {status: 'denied'}} />;
}
