import {FugaPantalla} from '../../../components/refunds/fuga-pantalla';
import {AreaRestringida} from '../../../components/copiloto/area-restringida';
import {MODOS} from '../../../lib/copiloto/modos.mjs';
import {allowed,cfoAccessForPage} from '../cfo/_lib/access';
export const metadata={title:'Fuga de reembolsos'};
export const dynamic='force-dynamic';
type Search=Promise<Record<string,string|string[]|undefined>>;
// /refunds es una pantalla normal del espacio de trabajo (mismo encabezado y márgenes que las demás); el chat vive en «Pregúntale a tus datos».
export default async function Page({searchParams}:{searchParams:Search}){
 const access=await cfoAccessForPage(await searchParams);
 if(!allowed(access.role))return <AreaRestringida modo={MODOS.refunds}/>;
 return <FugaPantalla organization={access.mode==='fixture'?'Organización de demostración (datos sintéticos)':undefined}/>;
}
