export type VistaAcciones='por-decidir'|'en-curso'|'resultados';
/** Vista elegida en /interventions (?vista=en-curso|resultados); sin valor = En curso (alias histórico de la pantalla). */
export const vistaDe=(raw:string|null|undefined):VistaAcciones|null=>{const v=new URLSearchParams(raw??'').get('vista');return v==='en-curso'||v==='resultados'?v:null;};
export const ESTADOS_VISTA:Record<'en-curso'|'resultados',readonly string[]>={'en-curso':['draft','approved','active','measuring'],resultados:['closed']};
