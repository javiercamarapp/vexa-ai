// Ficha de problema (23-oct): GET /api/problems/:id/facts. Datos sintéticos; variantes por query (?variant=) solo para la auditoría visual:
//   parcial = partes que no alcanzaron su tope (null/unavailable), sinadjuntos = 0 adjuntos enlazados, crit = grupo con revisión crítica por categoría.
const LABELS=['Shipping: Delivery Not Received','Payment: Duplicate Charge','Warranty: Battery Replacement','Other: Retailer notifications and system alerts','Shipping: Damaged in Transit','Order: Spare Parts','Return: No Longer Wanted','Billing: Missing Tax ID','Return: Refund Delay','Support: No Reply in 48h'];
export async function respondExtra(url,method,bodyText,ctx){
 const x=new URL(url,'http://x'),m=/^\/api\/problems\/([0-9a-f-]{36})\/facts$/.exec(x.pathname);
 if(!m||method!=='GET')return null;
 const id=m[1],n=Number(id.slice(-12)),i=n>=5100&&n<5110?n-5100:2,variant=x.searchParams.get('variant')??'';
 const label=LABELS[i],conv=336-i*20;
 const base={problemId:id,generatedAt:'2026-10-23T03:00:00.000Z',class:'observed',label,grupo:{n:1,de:i%3===2?12:1},conversations:conv,citations:Math.round(conv*1.44),severity:['high','medium','low'][i%3],severityMix:{high:60,medium:124,low:300},
  critical:{critical:i%2===0,signals:i%2===0?60:0,reason:i%2===0?'severity':null},themes:[{category:label,count:300},{category:'Warranty: Charger Replacement',count:124},{category:'Feedback: Negative',count:60}],
  recommendations:{state:'ok',items:i===2||i===0?[{id:'00000000-0000-4000-8000-000000000301',title:label,status:'proposed',version:1,action:'Revisar',intervention:i===0?'draft':null}]:[]},
  attachments:{state:'ok',total:variant==='sinadjuntos'?0:6,conversaciones:variant==='sinadjuntos'?0:3,porClase:variant==='sinadjuntos'?{}:{imagen:5,video:1},cobertura:{enlazados:783,total:8188}},
  parts:{catalog:'ok',signals:'ok',meta:'ok'},note:'x'};
 if(variant==='parcial')return [200,{data:{...base,citations:null,severity:null,severityMix:null,critical:null,themes:null,recommendations:{state:'unavailable',items:[]},attachments:{state:'unavailable'},parts:{catalog:'ok',signals:'unavailable',meta:'unavailable'}}}];
 return [200,{data:base}];
}
