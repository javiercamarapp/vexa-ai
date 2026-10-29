import {CCO_ROLES} from '@vexa/platform/capabilities';
import {idiomaActual} from '../../../../lib/i18n/servidor';
import {traductor} from '../../../../lib/i18n';
import {CcoPantalla} from '../../../../components/cco/cco-pantalla';
import {Empty} from '../../../../components/platform/primitives';
import {PageHeader} from '../../../../components/ui/page-header';
import {LinkButton} from '../../../../components/ui/button';
import {cfoAccessForPage} from '../cfo/_lib/access';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.cco');
export const dynamic='force-dynamic';
type Search=Promise<Record<string,string|string[]|undefined>>;
// Dinero: solo los roles de la capacidad CCO_ROLES (propietarios y analistas, igual que el menú); el servidor lo vuelve a comprobar en /api/cco.
export default async function Page({searchParams}:{searchParams:Search}){
 const access=await cfoAccessForPage(await searchParams),t=traductor(await idiomaActual());
 if(!(CCO_ROLES as readonly string[]).includes(access.role))return <div className="cf-page"><PageHeader eyebrow={t('cco.eyebrow')} title={t('cco.titulo')} description={t('cco.desc')}/>
  <Empty title={t('cco.sinAcceso')} tone="muted" action={<LinkButton href="/overview">{t('pp.volverResumen')}</LinkButton>}>{t('pp.sinAccesoCuerpo')}</Empty></div>;
 return <CcoPantalla organization={access.mode==='fixture'?t('tr.pag.demoOrg'):undefined}/>;
}
