// Textos y formato de las esperas largas (primera carga en frío). No promete una duración exacta: da una cota y muestra el tiempo transcurrido.
/** 0 -> «0 s», 59 -> «59 s», 65 -> «1 min 05 s», 120 -> «2 min». */
export function tiempoTranscurrido(segundos){
 const s=Math.max(0,Math.floor(Number(segundos)||0));
 if(s<60)return `${s} s`;
 const m=Math.floor(s/60),r=s%60;
 return r===0?`${m} min`:`${m} min ${String(r).padStart(2,'0')} s`;
}
export const ESPERA={
 recomendaciones:{titulo:'Cargando las recomendaciones guardadas…',detalle:'La evidencia se verificó al guardar y se vuelve a verificar al abrir cada una; esa verificación puede tardar.'},
 explorador:{titulo:'Preparando las citas verificables…',detalle:'La primera carga puede tardar; verificamos solo los problemas que ves. Mostramos cuánto llevas.'},
 evidencia:{titulo:'Verificando la evidencia…',detalle:'Se comprueba cada cita contra su conversación vigente antes de mostrarla; puede tardar unos segundos.'},
 actualizando:{titulo:'Actualizando la lista…',detalle:'Se verifican solo los problemas de esta página. Puede tardar más de un minuto en consultas pesadas: mostramos cuánto llevas, y la cifra anterior ya no es el resultado.'},
 resumen:{titulo:'Verificando el corte publicado…',detalle:'La primera carga puede tardar más de lo habitual.'},
 problemas:{titulo:'Verificando los problemas y su evidencia…',detalle:'La primera carga puede tardar más de lo habitual.'},
 brief:{titulo:'Verificando el brief…',detalle:'La primera carga puede tardar más de lo habitual.'},
 generarBrief:{titulo:'Generando el brief y verificando su evidencia…',detalle:'Puede tardar 2–3 minutos; no cierres esta pestaña. No se envía correo.'}
};
