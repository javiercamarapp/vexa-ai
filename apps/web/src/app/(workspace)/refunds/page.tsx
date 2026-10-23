import {CopilotoNegocio} from '../../../components/copiloto/copiloto-negocio';
import {AreaRestringida} from '../../../components/copiloto/area-restringida';
import {MODOS} from '../../../lib/copiloto/modos.mjs';
import {allowed,cfoAccessForPage} from '../cfo/_lib/access';
export const metadata={title:'Fuga de reembolsos'};
export const dynamic='force-dynamic';
type Search=Promise<Record<string,string|string[]|undefined>>;
// /refunds abre el MODO COPILOTO de reembolsos: su informe estructurado (components/refunds/*) como briefing y el chat del agente general.
export default async function Page({searchParams}:{searchParams:Search}){
 const access=await cfoAccessForPage(await searchParams);
 if(!allowed(access.role))return <AreaRestringida modo={MODOS.refunds}/>;
 return <CopilotoNegocio modo="refunds" organization={access.mode==='fixture'?'Organización de demostración (datos sintéticos)':undefined}/>;
}
