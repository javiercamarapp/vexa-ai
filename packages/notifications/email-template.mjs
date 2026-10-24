import {IDENTITY, renderLayout, safeText, truncate, fmtFechaHora} from './email-system.mjs';

// Notificaciones propias de la app (CORREOS-DISENO.md, secciones B y D). HTML + texto plano a partir de los
// mismos bloques. Los asuntos son fijos y no llevan datos de personas ni de clientes: solo el nombre del
// espacio (truncado) en la invitación. `resourceLabel` nunca va al asunto y solo se muestra en los tipos
// que lo permiten, con una lista blanca estricta.
const ANTI = 'Rovaq nunca te pedirá tu contraseña por correo.';

export const ROLES = Object.freeze({
  Propietario: Object.freeze({funcion: 'administrar el espacio, las personas y la facturación', descripcion: 'administra el espacio, las personas y la facturación'}),
  Analista: Object.freeze({funcion: 'consultar y analizar datos y preparar informes', descripcion: 'consulta y analiza datos, prepara informes'}),
  Operador: Object.freeze({funcion: 'atender solicitudes y tareas del día a día', descripcion: 'atiende solicitudes y tareas del día a día'}),
  Lector: Object.freeze({funcion: 'consultar los datos sin modificarlos', descripcion: 'consulta sin modificar'}),
});

// [type, subject, preheader, eyebrow, alert, heading, body, cta, reason, route, kind, labelAllowed]
const definitions = [
  ['digest.available', 'Tienes avisos nuevos en Rovaq', 'Consulta qué cambió en tu espacio. Cada aviso indica su fuente.', 'Avisos', false, 'Tu equipo tiene novedades', 'Consulta tus avisos y los recursos que tu equipo te autorizó, dentro de tu espacio de trabajo.', 'Ver avisos', 'eres usuario de Rovaq y activaste estos avisos', 'notifications', 'notification', false],
  ['membership.welcome', 'Tu espacio en Rovaq está listo', 'Tres lugares para empezar: Hoy, Pregúntale a tus datos y Acciones.', 'Bienvenida', false, 'Tu espacio está listo', 'Estos son los tres lugares para empezar:', 'Abrir Rovaq', 'entraste por primera vez a tu espacio de Rovaq. Es el único correo de bienvenida', 'memberships', 'notification', false],
  ['membership.invited', 'Te invitaron a un espacio en Rovaq', 'Acepta la invitación para entrar al equipo. Es personal y no se reenvía.', 'Invitación al equipo', false, 'Te invitaron a un espacio', 'Abre la invitación para revisar el equipo y tu acceso.', 'Aceptar invitación', 'una persona de tu organización escribió esta dirección al invitar personas a su espacio', 'invitations', 'invitation', false],
  ['brief.available', 'Hay un brief nuevo en Rovaq', 'Prioridades, fuentes y decisiones pendientes de tu equipo.', 'Brief', false, 'Las prioridades de tu equipo, en un solo lugar', 'Hay un brief disponible. Reúne el análisis, sus fuentes y las decisiones pendientes. Cada cifra indica su periodo y su fuente.', 'Abrir el brief', 'tienes acceso a este brief y activaste sus avisos', 'briefs', 'notification', false],
  ['intervention.assigned', 'Tienes una acción asignada en Rovaq', 'Revisa el objetivo, la evidencia y los próximos pasos.', 'Acción', false, 'Una acción espera tu revisión', 'Se te asignó una acción. Revisa su objetivo, la evidencia y los próximos pasos antes de registrarla.', 'Abrir la acción', 'esta acción está asignada a tu usuario y activaste sus avisos', 'interventions', 'notification', false],
  ['connection.attention', 'Una conexión necesita tu atención', 'Hasta que se revise, algunas cifras pueden estar desfasadas.', 'Requiere acción · Conexión', true, 'Revisa el estado de tu conexión', 'Una conexión de tu organización necesita revisión. Consulta su estado y las instrucciones disponibles antes de decidir cómo continuar.', 'Ver el estado de la conexión', 'tienes permiso para revisar esta conexión y activaste sus avisos', 'connections', 'notification', true],
  ['processing.failed', 'Una importación terminó con errores', 'Las cifras que dependen de ella pueden quedar parciales.', 'Requiere acción · Datos', true, 'Revisa la importación pendiente', 'Una importación no pudo completarse. Consulta el error y las opciones disponibles. Las filas con error no se cuentan como cero y las cifras que dependen de ellas quedan parciales.', 'Revisar los errores', 'tienes acceso a esta importación y activaste sus avisos', 'jobs', 'notification', true],
];
export const catalog = Object.freeze(definitions.map(([type, subject, preheader, eyebrow, alert, heading, body, cta, reason, route, kind, labelAllowed]) => Object.freeze({type, subject, preheader, eyebrow, alert, heading, body, cta, reason, route, kind, labelAllowed, templateImplemented: true, connected: type !== 'membership.invited'})));
export const definition = type => catalog.find(entry => entry.type === type);

export function appURL(value, appOrigin) {
  if (typeof value !== 'string' || /[\x00-\x20\x7f\\]/.test(value) || /%(?:0[ad]|5c)/i.test(value)) throw Error('invalid_url');
  const base = new URL(appOrigin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('invalid_origin');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password) throw Error('invalid_url');
  return url.href;
}

/** Etiqueta de recurso: solo nombres cortos y neutros (sin correos, cifras largas, importes ni marcado). */
export function safeResourceLabel(value) {
  if (typeof value !== 'string' || value.length > 40) throw Error('invalid_label');
  const v = value.trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._()\-·]{0,39}$/u.test(v) || /\d{5,}/.test(v)) throw Error('invalid_label');
  return v;
}

/** Cabeceras de baja: solo notificaciones y reportes, nunca acceso, invitación ni seguridad. */
export function unsubscribeHeaders(url, appOrigin) {
  const href = appURL(url, appOrigin);
  return {'List-Unsubscribe': `<${href}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'};
}
export const baseHeaders = Object.freeze({'Content-Language': 'es-MX', 'Auto-Submitted': 'auto-generated'});

const optional = (value, max, name) => (value === undefined || value === null || value === '' ? undefined : safeText(value, max, name));

/**
 * Renderiza una notificación.
 * @param {{type:string,appOrigin:string,ctaUrl:string,resourceLabel?:string,espacio?:string,rol?:string,invita?:string,vence?:string,unsubscribeUrl?:string}} input
 *   `vence` es una fecha ISO. `invita`, `espacio` y `rol` solo se leen en bienvenida e invitación.
 * @returns {{subject:string,preheader:string,html:string,text:string,headers:Record<string,string>}}
 */
export function renderEmail({type, appOrigin, ctaUrl, resourceLabel = '', espacio, rol, invita, vence, unsubscribeUrl}) {
  const entry = definition(type);
  if (!entry) throw Error('unknown_event');
  const url = appURL(ctaUrl, appOrigin);
  const prefs = appURL(new URL('/settings/notifications', appOrigin).href, appOrigin);
  if (resourceLabel !== '' && !entry.labelAllowed) throw Error('label_not_allowed');
  const label = resourceLabel === '' ? undefined : safeResourceLabel(resourceLabel);
  const space = optional(espacio, 40, 'space');
  const role = optional(rol, 20, 'role');
  if (role && !ROLES[role]) throw Error('invalid_role');

  let subject = entry.subject, h1 = entry.heading;
  const blocks = [], note = [];
  const footer = {strong: ANTI, motive: ''};
  if (type === 'membership.welcome') {
    if (space) h1 = `Tu espacio ${space} está listo`;
    blocks.push({type: 'p', text: role ? `Entraste con el rol de **${role}**. ${entry.body}` : entry.body});
    blocks.push({type: 'list', rows: [
      {label: 'Hoy', value: 'El resumen de la semana con las cifras que requieren atención.'},
      {label: 'Pregúntale a tus datos', value: 'Preguntas en lenguaje natural, con la fuente de cada cifra.'},
      {label: 'Acciones', value: 'Lo que Rovaq recomienda y queda por decidir.'},
    ]});
    blocks.push({type: 'button', label: entry.cta, href: url});
    blocks.push({type: 'help', text: 'Cada cifra indica su fuente, el periodo y si es observada, estimada o inferida. Lo que no sabemos también aparece, en Datos y confianza.'});
    footer.motive = `Recibes este correo porque entraste por primera vez a ${space ?? 'tu espacio de Rovaq'}. Es el único correo de bienvenida. [Elegir qué avisos recibir](${prefs})`;
  } else if (type === 'membership.invited') {
    const who = optional(invita, 40, 'inviter');
    if (space) subject = `Te invitaron a ${truncate(space, 24)} en Rovaq`;
    h1 = `${who ?? 'Una persona'} te invitó a ${space ?? 'un espacio'}`;
    blocks.push({type: 'p', text: role ? `Podrás ${ROLES[role].funcion}, con el rol de **${role}**.` : 'Podrás colaborar con tu equipo.'});
    const rows = [];
    if (space) rows.push({label: 'Espacio', value: space});
    if (role) rows.push({label: 'Rol', value: `${role} · ${ROLES[role].descripcion}`});
    if (who) rows.push({label: 'Invitó', value: who});
    if (vence) rows.push({label: 'Vence', value: fmtFechaHora(vence)});
    if (rows.length) blocks.push({type: 'list', rows});
    blocks.push({type: 'button', label: entry.cta, href: url});
    blocks.push({type: 'help', text: 'Si todavía no tienes cuenta, la crearás al aceptar. Puedes rechazar la invitación sin consecuencias; basta con ignorar este correo.'});
    note.push({type: 'help', text: `¿No conoces a ${who ?? 'quien te invita'} o no esperabas esto? No abras el enlace y avísanos en [${IDENTITY.supportEmail}](mailto:${IDENTITY.supportEmail}).`});
    note.push({type: 'urlLine', lead: 'Si el botón no abre, copia esta dirección en tu navegador:', url});
    footer.extra = 'El enlace es personal; no lo reenvíes.';
    footer.motive = `Recibes este correo porque ${who ?? 'una persona'} escribió esta dirección al invitar personas a ${space ?? 'su espacio'}.`;
  } else {
    blocks.push({type: 'p', text: entry.body});
    if (label) blocks.push({type: 'list', rows: [{label: 'Recurso', value: label}]});
    blocks.push({type: 'button', label: entry.cta, href: url});
    footer.motive = `Recibes este aviso porque ${entry.reason}. [Elegir qué avisos recibir](${prefs})`;
  }
  const assetOrigin = new URL(appOrigin).origin;
  const {html, text} = renderLayout({go: false, assetOrigin, subject, preheader: entry.preheader, eyebrow: entry.eyebrow, alert: entry.alert, h1, blocks, note, footer});
  const headers = {...baseHeaders, ...(entry.kind === 'notification' && unsubscribeUrl ? unsubscribeHeaders(unsubscribeUrl, appOrigin) : {})};
  return {subject, preheader: entry.preheader, html, text, headers};
}
