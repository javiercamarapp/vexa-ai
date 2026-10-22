// Filtro del ruido SOLO en presentación y ranking. Nada de esto se persiste ni borra datos:
// las notificaciones automáticas siguen en la base y vuelven al activar el interruptor.
import {esCategoriaRuido,CATEGORIA_RUIDO,CATEGORIAS} from './categorias.mjs';
const NOTIF=/notificaciones autom[aá]ticas|retailer notifications|system alerts|alertas del sistema/i;
/** ¿El texto (título, categoría o resumen) describe notificaciones automáticas? */
export function esRuido(texto){
 if(typeof texto!=='string'||!texto.trim())return false;
 return esCategoriaRuido(texto)||texto.includes(CATEGORIA_RUIDO)||texto.includes(CATEGORIAS[CATEGORIA_RUIDO])||NOTIF.test(texto);
}
/** Reparte elementos en visibles y ocultos. `textos(x)` devuelve los campos a inspeccionar. */
export function separarRuido(items,textos,incluir=false){
 const lista=Array.isArray(items)?items:[];
 if(incluir)return {visibles:lista,ocultos:[],ocultosN:0};
 const visibles=[],ocultos=[];
 for(const it of lista)(textos(it).some(esRuido)?ocultos:visibles).push(it);
 return {visibles,ocultos,ocultosN:ocultos.length};
}
/** Filas {category,count}: devuelve las visibles y cuántas incidencias se ocultaron. */
export function separarRuidoCategorias(filas,incluir=false){
 const lista=Array.isArray(filas)?filas:[];
 if(incluir)return {visibles:lista,gruposOcultos:0,incidenciasOcultas:0};
 const ocultas=lista.filter(f=>esCategoriaRuido(f.category));
 return {visibles:lista.filter(f=>!esCategoriaRuido(f.category)),gruposOcultos:ocultas.length,incidenciasOcultas:ocultas.reduce((n,f)=>n+(Number.isFinite(f.count)?f.count:0),0)};
}
