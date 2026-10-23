import {GapsPantalla} from '../../../components/gaps/gaps-pantalla';
import {Empty} from '../../../components/platform/primitives';
import {PageHeader} from '../../../components/ui/page-header';
import {LinkButton} from '../../../components/ui/button';
import {allowed,cfoAccessForPage} from '../cfo/_lib/access';
export const metadata={title:'Brechas de ingreso'};
export const dynamic='force-dynamic';
type Search=Promise<Record<string,string|string[]|undefined>>;
export default async function Page({searchParams}:{searchParams:Search}){
 const access=await cfoAccessForPage(await searchParams);
 if(!allowed(access.role))return <div className="cf-page"><PageHeader eyebrow="Dinero" title="Brechas de ingreso" description="Dónde ganas, dónde pierdes y dónde podrías ganar más."/>
  <Empty title="Tu rol no tiene acceso a este panel" tone="muted" action={<LinkButton href="/overview">Volver al resumen</LinkButton>}>Esta pantalla muestra ingresos y dinero devuelto por producto. Solo la ven los propietarios y analistas de la organización; pide acceso a un propietario.</Empty></div>;
 return <GapsPantalla organization={access.mode==='fixture'?'Organización de demostración (datos sintéticos)':undefined}/>;
}
