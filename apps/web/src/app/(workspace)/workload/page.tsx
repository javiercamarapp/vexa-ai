import {CargaPantalla} from '../../../components/workload/carga-pantalla';
import {Empty} from '../../../components/platform/primitives';
import {PageHeader} from '../../../components/ui/page-header';
import {LinkButton} from '../../../components/ui/button';
import {allowed,cfoAccessForPage} from '../cfo/_lib/access';
export const metadata={title:'Carga y SLA'};
export const dynamic='force-dynamic';
type Search=Promise<Record<string,string|string[]|undefined>>;
export default async function Page({searchParams}:{searchParams:Search}){
 const access=await cfoAccessForPage(await searchParams);
 if(!allowed(access.role))return <div className="cf-page"><PageHeader eyebrow="Operación" title="Carga y SLA" description="Carga de conversaciones y riesgo de SLA de 24 horas."/>
  <Empty title="Tu rol no tiene acceso a este panel" tone="muted" action={<LinkButton href="/overview">Volver al resumen</LinkButton>}>Solo lo ven los propietarios y analistas de la organización; pide acceso a un propietario.</Empty></div>;
 return <CargaPantalla organization={access.mode==='fixture'?'Organización de demostración (datos sintéticos)':undefined}/>;
}
