// Estado legible de cada conexión, derivado de los MISMOS datos que muestra el Explorador (resumen de cobertura, /api/coverage).
// Reglas: desconocido no es cero; «rechazadas» de HubSpot nunca se muestra sin desglose (los registros solo de metadatos no son conversaciones perdidas);
// un archivo ya cargado no está «pendiente». Sin cobertura (consulta fuera de tiempo) cae al estado de salud sin inventar nada.
const nf=new Intl.NumberFormat('es-MX');
/** 7930 -> «7,9 mil»; 482136 -> «482 mil»; 1_200_000 -> «1,2 millones». Menos de 1000 va exacto. */
export function mil(n){
 if(!Number.isFinite(n))return '—';
 if(n<1000)return nf.format(n);
 if(n>=1e6)return String(Math.round(n/1e5)/10).replace('.',',')+' millones';
 const k=Math.round(n/100)/10;return String(k>=100?Math.round(k):k).replace('.',',')+' mil';
}
/** Clave de la fuente en el resumen de cobertura para cada tipo de conexión. */
export const CLAVE_COBERTURA=Object.freeze({csv:'csv',xlsx:'excel',excel:'excel',hubspot:'hubspot',zendesk:'zendesk'});
/** Nombre de la fuente para el cliente. */
export const nombreFuente=(source)=>({csv:'CSV',xlsx:'Excel',excel:'Excel',hubspot:'HubSpot',zendesk:'Zendesk'})[source]??source;
const ARCHIVO=new Set(['csv','xlsx','excel']);
export const ETIQUETA_SALUD=Object.freeze({unknown:'Sin sincronización comprobada',running:'Sincronización en curso',healthy:'Última sincronización completada',partial:'Cobertura parcial',stale:'Sincronización pendiente de recuperar',reconnect_required:'Reconexión requerida'});
const saludOk=row=>['healthy','running','partial'].includes(row.state)&&row.errorCode!=='RECONNECT_REQUESTED';
/**
 * @param row  ConnectionHealth ({source,state,errorCode,lastSuccess,coverage,...})
 * @param sources  CoverageSource[] del resumen de cobertura, o null si no se pudo consultar
 * @returns {{ok:boolean,tone:'ok'|'warn'|'bad'|'muted',chip:string,estado:string,lineas:string[],anillo:{valor:number,pct:number}|null,ultimo:{rotulo:string,valor:string|null,vacio:string}}}
 */
export function estadoConexion(row,sources){
 const src=sources?.find(s=>s.key===CLAVE_COBERTURA[row.source]&&s.loaded&&s.status==='ok')??null;
 const vacio='Aún no hay una sincronización completa registrada';
 if(ARCHIVO.has(row.source)){
  if(src&&src.incorporated>0){
   const lineas=[`${nf.format(src.imports)} ${src.imports===1?'carga':'cargas'}${src.openImports>0?` (${nf.format(src.openImports)} en curso)`:''} · ${nf.format(src.incorporated)} filas incorporadas de ${nf.format(src.total)} leídas`];
   if(src.pending>0)lineas.push(`${nf.format(src.pending)} filas pendientes de procesar`);
   return {ok:true,tone:'ok',chip:'Cargado',estado:`Cargado · ${nf.format(src.incorporated)} filas`,lineas,anillo:null,ultimo:{rotulo:'Última carga',valor:src.lastUpdate,vacio}};
  }
  if(src)return {ok:false,tone:'warn',chip:'Sin filas',estado:'Cargas registradas sin filas incorporadas',lineas:[`${nf.format(src.imports)} cargas; ${nf.format(src.total)} filas leídas, ninguna incorporada.`],anillo:null,ultimo:{rotulo:'Última carga',valor:src.lastUpdate,vacio}};
  if(sources)return {ok:false,tone:'muted',chip:'Sin cargas',estado:'Aún no se ha cargado ningún archivo',lineas:[],anillo:null,ultimo:{rotulo:'Última carga',valor:null,vacio:'Aún no hay cargas registradas'}};
  return {ok:false,tone:'muted',chip:'Sin comprobar',estado:'No se pudo comprobar las cargas ahora',lineas:[],anillo:null,ultimo:{rotulo:'Última carga',valor:null,vacio:'No disponible ahora'}};
 }
 const ok=saludOk(row),tone=row.state==='healthy'&&row.errorCode!=='RECONNECT_REQUESTED'?'ok':row.state==='reconnect_required'?'bad':row.state==='unknown'?'muted':'warn';
 const base=row.errorCode==='RECONNECT_REQUESTED'?'Permisos pendientes de comprobar':ok?'Conectada':(ETIQUETA_SALUD[row.state]??'Estado pendiente de comprobar');
 const lineas=[];let estado=base,anillo=null;
 if(src){
  const enCurso=src.openImports>0,bd=src.rejectionBreakdown?.status==='ok'?src.rejectionBreakdown:null;
  if(enCurso&&ok)estado=`${base} · importación en curso`;
  if(bd){
   const aprox=n=>n>=1000?'≈'+mil(n):mil(n),parte=bd.incorporatedShare===null?'':` (≈${Math.round(bd.incorporatedShare)} %)`;
   if(bd.incorporatedShare!==null)anillo={valor:bd.incorporatedShare/100,pct:Math.round(bd.incorporatedShare)};
   lineas.push(`${mil(bd.conversationIncorporated??src.incorporated)} conversaciones incorporadas de ${aprox(bd.conversationRows??0)} con conversación${parte}`);
   if((bd.metadataOnly??0)>0)lineas.push(`${mil(bd.metadataOnly)} registros solo de metadatos (sin mensajes; no son conversaciones perdidas)`);
   if((bd.defects??0)>0)lineas.push(`${nf.format(bd.defects)} con defecto de validación`);
  }else lineas.push(`${nf.format(src.incorporated)} de ${nf.format(src.total)} filas leídas están incorporadas; el desglose del resto no está disponible ahora.`);
  if(src.pending>0)lineas.push(`${nf.format(src.pending)} filas pendientes de procesar`);
 }else if(row.coverage&&row.coverage.observed>0){anillo={valor:row.coverage.accepted/row.coverage.observed,pct:Math.round(row.coverage.accepted*100/row.coverage.observed)};lineas.push(`${nf.format(row.coverage.accepted)} de ${nf.format(row.coverage.observed)} registros incorporados; el resto no se desglosa todavía.`);}
 const ultimo=row.lastSuccess?{rotulo:'Último éxito',valor:row.lastSuccess,vacio}:src?.lastUpdate?{rotulo:'Última actualización de datos',valor:src.lastUpdate,vacio}:{rotulo:'Último éxito',valor:null,vacio};
 return {ok,tone,chip:ok?'Conectada':'Pendiente',estado,lineas,anillo,ultimo};
}
const NOMBRE_FUENTE={hubspot:'HubSpot',csv:'Archivos CSV',zendesk:'Zendesk'};
/** Texto de base de una cifra de importaciones: «Archivos CSV 482,136 + HubSpot 8,291» (la suma por fuente que explica el total; cada tarjeta de Fuentes muestra UNA fuente). */
export const desgloseImportaciones=(porFuente,campo='incorporadas')=>(porFuente??[]).map(f=>`${f.nombre} ${new Intl.NumberFormat('es-MX').format(f[campo])}`).join(' + ');
/** KPIs de Importaciones desde el resumen de cobertura (todas las cargas, no solo las listadas). Fuentes que pasan por importaciones: HubSpot, CSV y Zendesk. */
export function agregadoImportaciones(sources){
 if(!Array.isArray(sources))return null;
 const as=sources.filter(s=>['hubspot','csv','zendesk'].includes(s.key)&&s.loaded&&s.status==='ok');
 let cargas=0,incorporadas=0,rechazadas=0,soloMetadatos=0,pendientes=0,sinDesglose=0;
 const porFuente=[];
 for(const s of as){
  cargas+=s.imports;incorporadas+=s.incorporated;pendientes+=s.pending;
  porFuente.push({key:s.key,nombre:NOMBRE_FUENTE[s.key]??s.label,cargas:s.imports,incorporadas:s.incorporated});
  const bd=s.rejectionBreakdown?.status==='ok'?s.rejectionBreakdown:null;
  if(s.key==='hubspot'&&s.rejected>0){if(bd){rechazadas+=bd.defects??0;soloMetadatos+=bd.metadataOnly??0;}else sinDesglose+=s.rejected;}
  else rechazadas+=s.rejected;
 }
 return {cargas,incorporadas,rechazadas,soloMetadatos,pendientes,sinDesglose,fuentes:as.length,porFuente};
}
