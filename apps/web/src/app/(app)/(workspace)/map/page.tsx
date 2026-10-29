import {MapaPantalla} from '../../../../components/map/mapa-pantalla';
import {Empty} from '../../../../components/platform/primitives';
import {PageHeader} from '../../../../components/ui/page-header';
import {LinkButton} from '../../../../components/ui/button';
import {allowed,cfoAccessForPage} from '../cfo/_lib/access';
import {metaTitulo} from '../../../../lib/i18n/titulo';
import {traductor} from '../../../../lib/i18n';
import {idiomaActual} from '../../../../lib/i18n/servidor';
export const generateMetadata=()=>metaTitulo('meta.titulo.map');
export const dynamic='force-dynamic';
type Search=Promise<Record<string,string|string[]|undefined>>;
export default async function Page({searchParams}:{searchParams:Search}){
 const t=traductor(await idiomaActual());
 const access=await cfoAccessForPage(await searchParams);
 if(!allowed(access.role))return <div className="cf-page"><PageHeader eyebrow={t('mapa.eyebrow')} title={t('nav.item.map')} description={t('tr.pag.mapDesc')}/>
  <Empty title={t('pp.sinAcceso')} tone="muted" action={<LinkButton href="/overview">{t('pp.volverResumen')}</LinkButton>}>{t('pp.sinAccesoCuerpo')}</Empty></div>;
 return <MapaPantalla organization={access.mode==='fixture'?t('tr.pag.demoOrg'):undefined}/>;
}
