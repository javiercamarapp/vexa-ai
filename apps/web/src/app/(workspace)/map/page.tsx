import {MapaPantalla} from '../../../components/map/mapa-pantalla';
import {Empty} from '../../../components/platform/primitives';
import {PageHeader} from '../../../components/ui/page-header';
import {LinkButton} from '../../../components/ui/button';
import {allowed,cfoAccessForPage} from '../cfo/_lib/access';
export const metadata={title:'Mapa de problemas'};
export const dynamic='force-dynamic';
type Search=Promise<Record<string,string|string[]|undefined>>;
export default async function Page({searchParams}:{searchParams:Search}){
 const access=await cfoAccessForPage(await searchParams);
 if(!allowed(access.role))return <div className="cf-page"><PageHeader eyebrow="Operación" title="Mapa de problemas" description="Casos de posventa por estado."/>
  <Empty title="Tu rol no tiene acceso a este panel" tone="muted" action={<LinkButton href="/overview">Volver al resumen</LinkButton>}>Solo lo ven los propietarios y analistas de la organización; pide acceso a un propietario.</Empty></div>;
 return <MapaPantalla organization={access.mode==='fixture'?'Organización de demostración (datos sintéticos)':undefined}/>;
}
