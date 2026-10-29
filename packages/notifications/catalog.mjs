// Labels/policy selectively adopted from 5fbf223 notification templates; no external transport.
import {idiomaDe} from './idioma.mjs';
const entries=[
 ['membership.welcome','Tu acceso está listo','Ya puedes entrar a tu espacio de trabajo y consultar los recursos que tu equipo te haya autorizado.'],
 ['membership.invited','Tu equipo te invita a colaborar','Una persona propietaria debe crear y reservar explícitamente la invitación. Este evento todavía no está conectado.'],
 ['brief.available','Las prioridades, en un solo lugar','Hay un brief disponible para tu equipo. Consulta el análisis, sus fuentes y las decisiones pendientes dentro de Rovaq AI.'],
 ['intervention.assigned','Una acción espera tu revisión','Se te ha asignado una intervención. Revisa su objetivo, la evidencia y los próximos pasos antes de registrar una acción.'],
 ['connection.attention','Revisa el estado de tu conexión','Una conexión de tu organización necesita revisión. Consulta su estado antes de decidir cómo continuar.'],
 ['processing.failed','Revisa el procesamiento pendiente','Un procesamiento no pudo completarse. Consulta el error y las opciones disponibles; no se presupone que los datos estén completos.'],
];
export const catalog=Object.freeze(entries.map(([type,label,description])=>Object.freeze({type,label,description,connected:type!=='membership.invited'})));
export const channels=Object.freeze([
 {id:'inapp',label:'Centro de notificaciones',deliveryAvailable:true,reason:'Los eventos autorizados se guardan con la operación de negocio. Requiere una política habilitada, tus preferencias y el consumidor activo.'},
 {id:'email',label:'Correo electrónico',deliveryAvailable:false,reason:'El adaptador está integrado. La configuración del remitente y proveedor se comprueba en el servidor; una preferencia no confirma entrega.'},
 {id:'push',label:'Notificaciones push',deliveryAvailable:false,reason:'El adaptador está integrado. Activa el dispositivo con consentimiento explícito; una preferencia no concede permiso del navegador.'},
].map(Object.freeze));
export function resourceHref(type,id){
 if(type==='brief.available')return '/briefs/'+id;
 if(type==='intervention.assigned')return null; // Repository supplies captured scope and the actual card anchor.
 if(type==='connection.attention')return '/connections';
 if(type==='processing.failed')return '/imports';
 if(type==='membership.welcome')return '/overview';
 return null;
}

// Misma lista en inglés (mismo orden y mismos tipos). Se elige con `catalogFor(idioma)` / `channelsFor(idioma)`; sin idioma, el español de arriba.
const entriesEn=[
 ['membership.welcome','Your access is ready','You can now enter your workspace and view the resources your team has given you access to.'],
 ['membership.invited','Your team invites you to collaborate','A workspace owner must explicitly create and reserve the invitation. This event is not connected yet.'],
 ['brief.available','Priorities, in one place','A brief is available for your team. Review the analysis, its sources and the pending decisions inside Rovaq AI.'],
 ['intervention.assigned','An action is waiting for your review','An intervention has been assigned to you. Review its goal, the evidence and the next steps before recording an action.'],
 ['connection.attention','Check the status of your connection','A connection in your organization needs review. Check its status before deciding how to proceed.'],
 ['processing.failed','Review the pending processing','A processing job could not be completed. Check the error and the available options; the data is not assumed to be complete.'],
];
const catalogEn=Object.freeze(entriesEn.map(([type,label,description])=>Object.freeze({type,label,description,connected:type!=='membership.invited'})));
const channelsEn=Object.freeze([
 {id:'inapp',label:'Notification center',deliveryAvailable:true,reason:'Authorized events are saved with the business operation. Requires an enabled policy, your preferences and the active consumer.'},
 {id:'email',label:'Email',deliveryAvailable:false,reason:'The adapter is integrated. The sender and provider configuration is checked on the server; a preference does not confirm delivery.'},
 {id:'push',label:'Push notifications',deliveryAvailable:false,reason:'The adapter is integrated. Turn on the device with explicit consent; a preference does not grant browser permission.'},
].map(Object.freeze));
export const catalogFor=idioma=>idiomaDe(idioma)==='en'?catalogEn:catalog;
export const channelsFor=idioma=>idiomaDe(idioma)==='en'?channelsEn:channels;
