// Fechas de corte legibles en español, siempre en UTC y rotuladas. Nunca inventa: lo que no se puede interpretar se devuelve tal cual.
const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESES_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/** «2026-10-05T00:00:00.000Z» -> «5 oct 2026 (UTC)». Con hora distinta de 00:00 añade «, 14:03 UTC». Con {idioma:'en'}: «Oct 5, 2026 (UTC)». Un valor no interpretable se devuelve sin cambios. */
export function fechaCorteLegible(valor,{hora=true,idioma='es'}={}){
 if(valor===null||valor===undefined||valor==='')return '';
 const texto=String(valor),m=/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(texto);
 if(!m)return texto;
 const mes=Number(m[2]),dia=Number(m[3]);
 if(mes<1||mes>12||dia<1||dia>31)return texto;
 const fecha=idioma==='en'?`${MESES_EN[mes-1]} ${dia}, ${m[1]}`:`${dia} ${MESES[mes-1]} ${m[1]}`;
 if(hora&&m[4]!==undefined&&(m[4]!=='00'||m[5]!=='00'))return `${fecha}, ${m[4]}:${m[5]} UTC`;
 return `${fecha} (UTC)`;
}
