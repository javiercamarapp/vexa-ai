type Alcance={dateStart:string|null;dateEnd:string|null;currency:string};
export type BorradorReclamo={identidad:string;texto:string};
/** La fecha de refresco no cambia la identidad; el periodo y SKU sí, aunque coincidan las cifras. */
export function identidadReclamo(sku:string,scope:Alcance|null,cuerpo:string){
 return JSON.stringify([sku,scope?.dateStart??null,scope?.dateEnd??null,scope?.currency??null,cuerpo]);
}
export function reconciliarBorrador(borrador:BorradorReclamo|null,identidad:string){
 return borrador?.identidad===identidad?borrador:null;
}
