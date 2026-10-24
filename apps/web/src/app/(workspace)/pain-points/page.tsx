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
 const access=await cfoAccessForPage(await searchParams);
 if(!allowed(access.role))return <div className="cf-page"><PageHeader eyebrow="Insights" title="Puntos de dolor" description="Dónde se pierde dinero y por qué, con evidencia hasta la fila."/>
  <Empty title="Tu rol no tiene acceso a este panel" tone="muted" action={<LinkButton href="/overview">Volver al resumen</LinkButton>}>Solo lo ven los propietarios y analistas de la organización; pide acceso a un propietario.</Empty></div>;
 return <PainPointsPantalla organization={access.mode==='fixture'?'Organización de demostración (datos sintéticos)':undefined}/>;
}
