// Human label for a technical source reference ("snapshot:refunds.settled"). The raw value is never lost: it stays in the chip title and is what "Copiar" copies.
import {X} from './legibilidad/trad.mjs';
const UUID='[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const RULES=[
 [/^snapshot:exposure\.global$/,(m,t)=>X(t,'tr.lg.sr.expGlobal','Exposición · total del corte')],
 [new RegExp('^snapshot:exposure\\.'+UUID+'$','i'),(m,t)=>X(t,'tr.lg.sr.expProb','Exposición · por problema')],
 [/^snapshot:orders\.all$/,(m,t)=>X(t,'tr.lg.sr.ordenes','Órdenes registradas · total del corte')],
 [/^snapshot:refunds\.settled$/,(m,t)=>X(t,'tr.lg.sr.reembLiq','Reembolsos liquidados · total del corte')],
 [new RegExp('^snapshot:refunds\\.'+UUID+'$','i'),(m,t)=>X(t,'tr.lg.sr.reembProb','Reembolsos · por problema')],
 [/^snapshot:model\.replacement$/,(m,t)=>X(t,'tr.lg.sr.reposicion','Costo de reposición · modelo')],
 [/^snapshot:([a-z_]+)\.([a-z_]+)$/,(m,t)=>X(t,'tr.lg.sr.corte','Corte · '+m[1]+' '+m[2],{a:m[1],b:m[2]})],
 [new RegExp('^conv:'+UUID+'#m(\\d+)$','i'),(m,t)=>X(t,'tr.lg.sr.convMsg','Conversación · mensaje '+m[1],{n:m[1]})],
];
export function sourceRefLabel(ref,t=null){const raw=String(ref??'');for(const [re,f] of RULES){const m=re.exec(raw);if(m)return f(m,t);}return raw;}
