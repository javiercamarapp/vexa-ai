import {OrgFicha} from '../../../../components/platform/org-ficha';
import {loadOrgDetail} from '../../../../lib/platform/org-detail';
import {platformAccessForPage} from '../../_lib/access';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.platform-organizaciones-id');
export const dynamic = 'force-dynamic';
export default async function Page({params}: {params: Promise<{id: string}>}) {
  const {id} = await params, access = await platformAccessForPage();
  return <OrgFicha id={id} initial={access ? await loadOrgDetail(access, id) : {status: 'error'}} />;
}
