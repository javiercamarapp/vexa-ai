import {NextResponse} from 'next/server';
import {readRequestText} from '../../../lib/request-body';
import {extraerInformes} from '../../../lib/sitio/csp-informe';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Recibe los informes de violación de la CSP candidata del sitio público (modo informe). Pública y sin sesión; el limitador general la cuenta como escritura.
// Sin PII: no se guarda nada, no se lee IP ni agente y del informe solo se registra la directiva, el origen bloqueado (sin ruta ni consulta) y la ruta del documento sin consulta.
const MAX=8192;
export async function POST(request:Request){
  try{
    const tipo=request.headers.get('content-type')??'';
    if(!/^application\/(?:csp-report|reports\+json|json)\b/i.test(tipo))return new NextResponse(null,{status:204});
    const cuerpo=JSON.parse(await readRequestText(request,MAX));
    for(const x of extraerInformes(cuerpo))console.info('csp-informe',JSON.stringify(x));
  }catch{/* un informe mal formado no merece respuesta distinta */}
  return new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
