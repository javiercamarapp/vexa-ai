// Lógica PURA de la pantalla «Problemas»: sin red, sin base de datos, sin React. Convierte el resumen del catálogo (o, sin él, los registros de la página)
// en filas legibles, las agrupa por categoría, numera los grupos del mismo título («grupo 2 de 14»), ordena y filtra.
// Honestidad: lo desconocido es null y nunca se convierte en 0; el importe solo existe si el registro trae uno exacto.
import {etiquetaCategoria} from './categorias.mjs';
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const clave=titulo=>norm(titulo)||'sin-categoria';
const exacto=m=>!!m&&m.amount_minor!==null&&m.amount_minor!==undefined&&/^-?\d+$/.test(String(m.amount_minor));
const primaria=item=>item?.metrics?.find(x=>x.kind==='exposure')??item?.metrics?.[0]??null;
const SEV={critical:4,high:3,medium:2,low:1};
const SEV_ES={critical:'Crítica',high:'Alta',medium:'Media',low:'Baja'};
export const etiquetaSeveridad=v=>v===null||v===undefined||v===''?null:(SEV_ES[v]??String(v));
const base=(id,titulo)=>({id,titulo,categoria:etiquetaCategoria(titulo),clave:clave(titulo)});
/** Filas desde meta.catalog.rows (todos los problemas vigentes). */
export function filasDesdeCatalogo(catalogo){
 return (catalogo?.rows??[]).map(r=>({...base(r.id,r.label),conversaciones:Number.isFinite(r.conversations)?r.conversations:null,severidad:r.severity??null,critico:typeof r.critical==='boolean'?r.critical:null,senalesCriticas:Number.isFinite(r.critical_signals)?r.critical_signals:null,motivoCritico:r.critical_reason??null,citas:Number.isFinite(r.citations)?r.citations:null,recomendaciones:Number.isFinite(r.recommendations)?r.recommendations:null,temas:Array.isArray(r.themes)?r.themes:null,importe:null}));
}
/** Filas desde los registros de la página (con importe cuando el corte trae vínculos). Lo que el registro no trae queda null. */
export function filasDesdeItems(items){
 return (items??[]).map(i=>{
  const inc=i.details?.find(d=>/^Incidencias/.test(d.label))?.value,n=inc!==undefined&&/^\d+$/.test(String(inc))?Number(inc):null,m=primaria(i);
  return {...base(i.id,i.title),conversaciones:n,severidad:null,critico:null,senalesCriticas:null,motivoCritico:null,citas:Array.isArray(i.evidence)?i.evidence.length:null,recomendaciones:null,importe:exacto(m)?m:null,metrica:m??null,registro:i};
 });
}
export const hayImporte=filas=>filas.some(f=>f.importe!==null&&f.importe!==undefined);
const porConversaciones=(a,b)=>(b.conversaciones??-1)-(a.conversaciones??-1)||a.id.localeCompare(b.id);
/** Añade grupo:{n,de}: posición del grupo dentro de su categoría (por conversaciones, empate por id) y cuántos grupos tiene. */
export function numerarGrupos(filas){
 const por=new Map();for(const f of filas){let a=por.get(f.clave);if(!a)por.set(f.clave,a=[]);a.push(f);}
 const pos=new Map();for(const a of por.values()){a.slice().sort(porConversaciones).forEach((f,i)=>pos.set(f.id,{n:i+1,de:a.length}));}
 return filas.map(f=>({...f,grupo:pos.get(f.id)}));
}
export const ETIQUETA_GENERAL='Grupo general (agrupación amplia; conviene re-agrupar)';
/** Marca `general:true` en el grupo que concentra una parte desproporcionada de las conversaciones (≥ umbral del total conocido) y hay más de un grupo. No inventa nombres: solo lo rotula. */
export function marcarGeneral(filas,{umbral=0.3}={}){
 const total=filas.reduce((n,f)=>n+(f.conversaciones??0),0);
 return filas.map(f=>({...f,general:filas.length>1&&total>0&&f.conversaciones!==null&&f.conversaciones/total>=umbral}));
}
export const fraseGrupo=f=>f.general?ETIQUETA_GENERAL:!f.grupo||f.grupo.de<=1?'Único grupo':`Grupo ${f.grupo.n} de ${f.grupo.de}`;
const sumaONull=(xs)=>xs.some(x=>x!==null&&x!==undefined)?xs.reduce((n,x)=>n+(x??0),0):null;
/** Categorías ordenadas por conversaciones (desc). criticos/ conversaciones = null si ninguna fila lo trae. */
export function agruparCategorias(filas){
 const por=new Map();for(const f of filas){let c=por.get(f.clave);if(!c)por.set(f.clave,c={clave:f.clave,nombre:f.categoria,filas:[]});c.filas.push(f);}
 return [...por.values()].map(c=>({clave:c.clave,nombre:c.nombre,grupos:c.filas.length,conversaciones:sumaONull(c.filas.map(f=>f.conversaciones)),criticos:c.filas.some(f=>f.critico!==null)?c.filas.filter(f=>f.critico===true).length:null,filas:c.filas.slice().sort(porConversaciones)}))
  .sort((a,b)=>(b.conversaciones??-1)-(a.conversaciones??-1)||a.nombre.localeCompare(b.nombre,'es'));
}
export function resumenFilas(filas){
 const conocido=filas.some(f=>f.critico!==null);
 return {grupos:filas.length,categorias:new Set(filas.map(f=>f.clave)).size,criticos:conocido?filas.filter(f=>f.critico===true).length:null,senalesCriticas:conocido&&filas.some(f=>f.senalesCriticas!==null)?filas.reduce((n,f)=>n+(f.critico===true?(f.senalesCriticas??0):0),0):null};
}
const VALOR={
 conversaciones:f=>f.conversaciones,citas:f=>f.citas,recomendaciones:f=>f.recomendaciones,
 severidad:f=>f.severidad===null?null:(SEV[f.severidad]??0),critico:f=>f.critico===null?null:(f.critico?1:0),
 importe:f=>f.importe?Number(BigInt(f.importe.amount_minor)):null,
};
/** Orden estable; los desconocidos (null) van SIEMPRE al final, también en descendente. */
export function ordenarFilas(filas,{col='conversaciones',dir='desc'}={}){
 const sign=dir==='asc'?1:-1;
 return filas.slice().sort((a,b)=>{
  if(col==='categoria'){const c=a.categoria.localeCompare(b.categoria,'es')*sign;return c||porConversaciones(a,b);}
  const f=VALOR[col]??VALOR.conversaciones,x=f(a),y=f(b);
  if(x===null&&y===null)return porConversaciones(a,b);
  if(x===null)return 1;if(y===null)return -1;
  return (x-y)*sign||porConversaciones(a,b);
 });
}
/** Búsqueda por palabras (todas deben aparecer), sin acentos ni mayúsculas (título y categoría en español; no busca en texto de conversación), categoría exacta y solo críticos. */
export function filtrarFilas(filas,{texto='',clave:k=null,soloCriticos=false}={}){
 const palabras=norm(texto).split(' ').filter(Boolean);
 return filas.filter(f=>{if(k&&f.clave!==k)return false;if(soloCriticos&&f.critico!==true)return false;if(!palabras.length)return true;const h=norm(f.titulo+' '+f.categoria);return palabras.every(p=>h.includes(p));});
}
