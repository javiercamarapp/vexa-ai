import {idiomaActual} from '../../../lib/i18n/servidor';
import {traductor} from '../../../lib/i18n';
import {PainPointsPantalla} from '../../../components/pain-points/pain-points-pantalla';
import {Empty} from '../../../components/platform/primitives';
import {PageHeader} from '../../../components/ui/page-header';
import {LinkButton} from '../../../components/ui/button';
import {allowed,cfoAccessForPage} from '../cfo/_lib/access';
export const metadata={title:'Puntos de dolor'};
export const dynamic='force-dynamic';
type Search=Promise<Record<string,string|string[]|undefined>>;
// Dinero: solo propietarios y analistas (igual que el menú); el servidor vuelve a comprobarlo en /api/pain-points.
export default async function Page({searchParams}:{searchParams:Search}){
 const access=await cfoAccessForPage(await searchParams),t=traductor(await idiomaActual());
 if(!allowed(access.role))return <div className="cf-page"><PageHeader eyebrow={t('pp.eyebrow')} title={t('pp.titulo')} description={t('pp.desc')}/>
  <Empty title={t('pp.sinAcceso')} tone="muted" action={<LinkButton href="/overview">{t('pp.volverResumen')}</LinkButton>}>{t('pp.sinAccesoCuerpo')}</Empty></div>;
 return <PainPointsPantalla organization={access.mode==='fixture'?'Organización de demostración (datos sintéticos)':undefined}/>;
}
