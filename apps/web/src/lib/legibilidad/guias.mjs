// Textos guía por vista: UNA línea bajo el título (qué se ve y de dónde sale) y un «¿Cómo leer esto?» opcional.
// Sin promesas de retorno y sin afirmar que la IA analizó todo el corpus. Módulo puro.
export const GLOSARIO=Object.freeze({
 incidencia:'Incidencia: una señal que la IA detectó en una conversación y clasificó en una categoría. Hay muchas más incidencias que problemas.',
 problema:'Problema agrupado: un conjunto de incidencias parecidas, con identidad estable y evidencia citable.',
 observado:'Observado: contado o leído directamente de un registro.',
 estimado:'Estimado: calculado con una muestra o un resumen; puede variar al reprocesar.',
 inferido:'Inferido: derivado de vínculos de evidencia; no equivale a pérdida, ahorro ni causa.',
 monedas:'Cada moneda se muestra por separado: nunca se suman ni se convierten.'
});
/** Bajada de «Problemas» según lo que el corte permite: ordenar por ingresos expuestos solo si hay importe; si no, por conversaciones. conImporte: true | false | null (aún sin cargar). */
/** `t` (traductor del idioma activo) es opcional: sin él sale el español canónico que fijan las pruebas. */
export const lineaProblemas=(conImporte,t=null)=>t?t(conImporte===true?'tr.gu.problemasPorImporte':conImporte===false?'tr.gu.problemasPorConv':'tr.gu.problemasSinOrden'):conImporte===null||conImporte===undefined?'Grupos de conversaciones parecidas, con su evidencia.':`Grupos de conversaciones parecidas, ordenados ${conImporte===true?'por ingresos expuestos':'por conversaciones'}, con su evidencia.`;
/** Orden de los puntos de «¿Cómo leer esto?» por vista: nombre del glosario compartido o c<n> (texto propio de la vista). Las claves viven en d-tr-g.ts. */
const COMO=Object.freeze({resumen:['observado','estimado','inferido','monedas','c4'],problemas:['incidencia','problema','c2','monedas','c4'],recomendaciones:['c0','c1','inferido'],explorador:['c0','c1','c2'],intervenciones:['c0','monedas'],brief:['c0','problema','monedas'],cliente:['c0','c1','monedas'],historial:['c0','c1','c2']});
export const GUIAS=Object.freeze({
 resumen:{titulo:'Resumen ejecutivo',linea:'Cifras del corte publicado: pedidos, reembolsos y conversaciones cargadas, cada una con su clase y su fuente.',como:[GLOSARIO.observado,GLOSARIO.estimado,GLOSARIO.inferido,GLOSARIO.monedas,'La exposición compartida entre problemas no se suma.']},
 problemas:{titulo:'Problemas de negocio',linea:'Problemas agrupados a partir de incidencias en conversaciones, ordenados por ingresos expuestos y con su evidencia.',como:[GLOSARIO.incidencia,GLOSARIO.problema,'Ingresos expuestos: importe de pedidos vinculados a la evidencia del problema. No es pérdida.',GLOSARIO.monedas,'Las notificaciones automáticas se ocultan del orden por defecto; puedes incluirlas con el interruptor.']},
 recomendaciones:{titulo:'Recomendaciones',linea:'Acciones propuestas por prioridad, cada una con las citas de conversaciones que la respaldan.',como:['Una recomendación es una propuesta para revisar, no un resultado garantizado.','Abre una recomendación para ver sus citas y la versión del problema en que se basa.',GLOSARIO.inferido]},
 explorador:{titulo:'Explorador de evidencia',linea:'Pregunta a tus datos y revisa cada cifra con su cita y su origen.',como:['La respuesta solo usa lo que tu acceso permite consultar y lo que está cargado.','Cada cifra indica si es observada, estimada o inferida, y de qué fuente sale.','Si falta un dato, la respuesta lo dice en lugar de suponerlo.']},
 intervenciones:{titulo:'Acciones',linea:'Acciones en curso con su plan, su avance y la medición antes y después.',como:['Una medición antes/después describe un cambio observado; no demuestra por sí sola que la intervención lo causó.',GLOSARIO.monedas]},
 brief:{titulo:'Brief ejecutivo',linea:'La lectura del corte en una página: cifras, prioridades y siguientes pasos, con su fuente.',como:['El brief resume el corte publicado; no agrega datos nuevos.',GLOSARIO.problema,GLOSARIO.monedas]},
 cliente:{titulo:'Historial del cliente',linea:'Pedidos, conversaciones y problemas vinculados a este cliente, con la procedencia de cada vínculo.',como:['Un vínculo une una conversación con un pedido o un problema; muestra de dónde sale.','Cada paso vuelve a comprobar tu acceso.',GLOSARIO.monedas]},
 historial:{titulo:'Histórico e identidad',linea:'Conversaciones anteriores que autorizas analizar por conexión; avanza en segundo plano y no publica cortes.',como:['Solo se procesa lo que autorizas para cada conexión.','El avance cuenta las conversaciones elegidas que ya se analizaron.','Procesar no publica cifras: la publicación es un paso aparte.']}
});
export const IDS_GUIA=Object.freeze(Object.keys(GUIAS));
/** Guía por id; una id desconocida devuelve null (la vista no muestra texto inventado). */
export function guia(id,t=null){
 if(!Object.prototype.hasOwnProperty.call(GUIAS,id))return null;
 if(!t)return GUIAS[id];
 return {titulo:t(`tr.gu.${id}.titulo`),linea:t(`tr.gu.${id}.linea`),como:COMO[id].map(c=>t(/^c\d$/.test(c)?`tr.gu.${id}.${c}`:`tr.gu.g.${c}`))};
}
