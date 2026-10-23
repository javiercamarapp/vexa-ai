export type GuiaId='resumen'|'problemas'|'recomendaciones'|'explorador'|'intervenciones'|'brief'|'cliente'|'historial';
export type Guia={titulo:string;linea:string;como:readonly string[]};
export const GLOSARIO:Readonly<Record<'incidencia'|'problema'|'observado'|'estimado'|'inferido'|'monedas',string>>;
export const GUIAS:Readonly<Record<GuiaId,Guia>>;
export const IDS_GUIA:readonly GuiaId[];
export function guia(id:string):Guia|null;

export function lineaProblemas(conImporte:boolean|null):string;
