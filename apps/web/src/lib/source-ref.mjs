// Human label for a technical source reference ("snapshot:refunds.settled"). The raw value is never lost: it stays in the chip title and is what "Copiar" copies.
const UUID='[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const RULES=[
 [/^snapshot:exposure\.global$/,()=>'Exposición · total del corte'],
 [new RegExp('^snapshot:exposure\\.'+UUID+'$','i'),()=>'Exposición · por problema'],
 [/^snapshot:orders\.all$/,()=>'Órdenes registradas · total del corte'],
 [/^snapshot:refunds\.settled$/,()=>'Reembolsos liquidados · total del corte'],
 [new RegExp('^snapshot:refunds\\.'+UUID+'$','i'),()=>'Reembolsos · por problema'],
 [/^snapshot:model\.replacement$/,()=>'Costo de reposición · modelo'],
 [/^snapshot:([a-z_]+)\.([a-z_]+)$/,(m)=>'Corte · '+m[1]+' '+m[2]],
 [new RegExp('^conv:'+UUID+'#m(\\d+)$','i'),(m)=>'Conversación · mensaje '+m[1]],
];
export function sourceRefLabel(ref){const raw=String(ref??'');for(const [re,f] of RULES){const m=re.exec(raw);if(m)return f(m);}return raw;}
