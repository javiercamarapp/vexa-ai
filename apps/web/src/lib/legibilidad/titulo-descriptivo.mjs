// Título descriptivo DETERMINISTA de un grupo de problemas, sin IA: categoría en español + los 2 temas (categorías de sus citas) más frecuentes, con conteos.
// Solo usa datos reales ya registrados (issues.category de las citas del grupo). Es una «descripción automática», no un nombre curado ni generado por un modelo.
import {etiquetaCategoria} from './categorias.mjs';
import {localeDe} from '../formato/idioma.mjs';
import {X,P,idiomaDe} from './trad.mjs';
export const ROTULO_AUTO='Descripción automática';
export const AVISO_AUTO='Descripción automática a partir de las categorías más frecuentes de las citas del grupo; no es un nombre curado ni generado por IA.';
/** Rótulo y aviso de la descripción automática en el idioma del traductor (sin traductor, el español de arriba). */
export const rotuloAuto=(t=null)=>X(t,'tr.lg.tituloAuto.rotulo',ROTULO_AUTO);
export const avisoAuto=(t=null)=>X(t,'tr.lg.tituloAuto.aviso',AVISO_AUTO);
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const partes=es=>{const i=es.indexOf(': ');return i<0?{familia:null,sub:es}:{familia:es.slice(0,i),sub:es.slice(i+2)};};
const minusEs=s=>s?s.charAt(0).toLowerCase()+s.slice(1):s;
// En inglés la taxonomía viene en mayúsculas de título («Spare Parts»): en medio de la frase va en minúsculas, salvo siglas (NT, OT) y nombres propios.
const PROPIOS=new Set(['Briggs','Stratton']);
const minusEn=s=>s?s.split(' ').map(w=>w.split('/').map(x=>PROPIOS.has(x)||/[A-Z].*[A-Z]|\d/.test(x)?x:x.replace(/^(\(?)([A-Z])/,(_,p,c)=>p+c.toLowerCase())).join('/')).join(' '):s;
/**
 * @param label        categoría del grupo (inglés o español)
 * @param temas        [{category,count}] categorías de las citas del grupo (cualquier orden); null = no disponible
 * @param conversaciones número de conversaciones del grupo (opcional)
 * @param t            traductor opcional: con él, la categoría sale con su nombre original en inglés y «conv.» pasa a «conversations»; los datos guardados no se traducen
 * @returns {principal, temas:[{nombre,n}], texto, conversaciones}|null  null si no hay etiqueta
 */
export function tituloDescriptivo({label,temas=null,conversaciones=null,max=2,t:tr=null}={}){
 if(typeof label!=='string'||!label.trim())return null;
 const nf=new Intl.NumberFormat(localeDe(idiomaDe(tr))),minus=idiomaDe(tr)==='en'?minusEn:minusEs;
 const es=etiquetaCategoria(label,tr),{familia,sub}=partes(es);
 const propia=norm(es);
 const otros=(Array.isArray(temas)?temas:[]).filter(t=>t&&Number.isFinite(t.count)&&t.count>0&&norm(etiquetaCategoria(t.category,tr))!==propia)
  .sort((a,b)=>b.count-a.count||String(a.category).localeCompare(String(b.category))).slice(0,max)
  .map(t=>{const p=partes(etiquetaCategoria(t.category,tr));return {nombre:p.familia===familia||!p.familia?minus(p.sub):p.familia.toLowerCase()+': '+minus(p.sub),n:t.count};});
 const principal=familia?`${familia} · ${minus(sub)}`:es;
 const conv=Number.isFinite(conversaciones)?' · '+P(tr,conversaciones,'tr.lg.tituloAuto.convUno','tr.lg.tituloAuto.conv',`${nf.format(conversaciones)} conv.`,`${nf.format(conversaciones)} conv.`,{n:nf.format(conversaciones)}):'';
 const texto=principal+(otros.length?` (${otros.map(o=>`${o.nombre} ${nf.format(o.n)}`).join(', ')})`:'')+conv;
 return {principal,temas:otros,texto,conversaciones:Number.isFinite(conversaciones)?conversaciones:null};
}
