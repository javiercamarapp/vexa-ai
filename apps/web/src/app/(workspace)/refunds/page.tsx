import {FugaPantalla} from '../../../components/refunds/fuga-pantalla';
import {Empty} from '../../../components/platform/primitives';
import {PageHeader} from '../../../components/ui/page-header';
import {LinkButton} from '../../../components/ui/button';
import {allowed,cfoAccessForPage} from '../cfo/_lib/access';
export const metadata={title:'Fuga de reembolsos'};
export const dynamic='force-dynamic';
type Search=Promise<Record<string,string|string[]|undefined>>;
export default async function Page({searchParams}:{searchParams:Search}){
 const access=await cfoAccessForPage(await searchParams);
 if(!allowed(access.role))return <div className="cf-page"><PageHeader eyebrow="Dinero" title="Fuga de reembolsos" description="Dinero devuelto, negado y atorado por SKU y canal."/>
  <Empty title="Tu rol no tiene acceso a este panel" tone="muted" action={<LinkButton href="/overview">Volver al resumen</LinkButton>}>Esta pantalla muestra dinero devuelto por producto. Solo la ven los propietarios y analistas de la organización; pide acceso a un propietario.</Empty></div>;
 return <FugaPantalla organization={access.mode==='fixture'?'Organización de demostración (datos sintéticos)':undefined}/>;
}
