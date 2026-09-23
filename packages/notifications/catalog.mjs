// Labels/policy selectively adopted from 5fbf223 notification templates; no external transport.
const entries=[
 ['membership.welcome','Tu acceso está listo','Ya puedes entrar a tu espacio de trabajo y consultar los recursos que tu equipo te haya autorizado.'],
 ['membership.invited','Tu equipo te invita a colaborar','Una persona propietaria debe crear y reservar explícitamente la invitación. Este evento todavía no está conectado.'],
 ['brief.available','Las prioridades, en un solo lugar','Hay un brief disponible para tu equipo. Consulta el análisis, sus fuentes y las decisiones pendientes dentro de VEXA.'],
 ['intervention.assigned','Una acción espera tu revisión','Se te ha asignado una intervención. Revisa su objetivo, la evidencia y los próximos pasos antes de registrar una acción.'],
 ['connection.attention','Revisa el estado de tu conexión','Una conexión de tu organización necesita revisión. Consulta su estado antes de decidir cómo continuar.'],
 ['processing.failed','Revisa el procesamiento pendiente','Un procesamiento no pudo completarse. Consulta el error y las opciones disponibles; no se presupone que los datos estén completos.'],
];
export const catalog=Object.freeze(entries.map(([type,label,description])=>Object.freeze({type,label,description,connected:false})));
export const channels=Object.freeze([
 {id:'inapp',label:'Centro de notificaciones',deliveryAvailable:false,reason:'El centro está disponible; los emisores de eventos todavía no están conectados.'},
 {id:'email',label:'Correo electrónico',deliveryAvailable:false,reason:'Envío por correo todavía no integrado. Guardar una preferencia no envía mensajes.'},
 {id:'push',label:'Notificaciones push',deliveryAvailable:false,reason:'Push todavía no integrado. Esta preferencia no registra dispositivos ni concede consentimiento del navegador.'},
].map(Object.freeze));
export function resourceHref(type,id){
 if(type==='brief.available')return '/briefs/'+id;
 if(type==='intervention.assigned')return null; // Repository supplies captured scope and the actual card anchor.
 if(type==='connection.attention')return '/connections';
 if(type==='processing.failed')return '/imports';
 if(type==='membership.welcome')return '/overview';
 return null;
}
