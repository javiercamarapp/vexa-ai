// Título descriptivo DETERMINISTA de un grupo de problemas, sin IA: categoría en español + los 2 temas (categorías de sus citas) más frecuentes, con conteos.
// Solo usa datos reales ya registrados (issues.category de las citas del grupo). Es una «descripción automática», no un nombre curado ni generado por un modelo.
import {etiquetaCategoria} from './categorias.mjs';
const nf=new Intl.NumberFormat('es-MX');
export const ROTULO_AUTO='Descripción automática';
export const AVISO_AUTO='Descripción automática a partir de las categorías más frecuentes de las citas del grupo; no es un nombre curado ni generado por IA.';
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const partes=es=>{const i=es.indexOf(': ');return i<0?{familia:null,sub:es}:{familia:es.slice(0,i),sub:es.slice(i+2)};};
const minus=s=>s?s.charAt(0).toLowerCase()+s.slice(1):s;
/**
 * @param label        categoría del grupo (inglés o español)
 * @param temas        [{category,count}] categorías de las citas del grupo (cualquier orden); null = no disponible
 * @param conversaciones número de conversaciones del grupo (opcional)
 * @returns {principal, temas:[{nombre,n}], texto, conversaciones}|null  null si no hay etiqueta
 */
export function tituloDescriptivo({label,temas=null,conversaciones=null,max=2}={}){
 if(typeof label!=='string'||!label.trim())return null;
 const es=etiquetaCategoria(label),{familia,sub}=partes(es);
 const propia=norm(es);
 const otros=(Array.isArray(temas)?temas:[]).filter(t=>t&&Number.isFinite(t.count)&&t.count>0&&norm(etiquetaCategoria(t.category))!==propia)
  .sort((a,b)=>b.count-a.count||String(a.category).localeCompare(String(b.category))).slice(0,max)
  .map(t=>{const p=partes(etiquetaCategoria(t.category));return {nombre:p.familia===familia||!p.familia?minus(p.sub):p.familia.toLowerCase()+': '+minus(p.sub),n:t.count};});
 const principal=familia?`${familia} · ${minus(sub)}`:es;
 const conv=Number.isFinite(conversaciones)?` · ${nf.format(conversaciones)} conv.`:'';
 const texto=principal+(otros.length?` (${otros.map(o=>`${o.nombre} ${nf.format(o.n)}`).join(', ')})`:'')+conv;
 return {principal,temas:otros,texto,conversaciones:Number.isFinite(conversaciones)?conversaciones:null};
}
