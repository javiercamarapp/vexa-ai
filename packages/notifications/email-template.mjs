import {IDENTITY, renderLayout, safeText, truncate, fmtFechaHora} from './email-system.mjs';
import {idiomaDe, langDe} from './idioma.mjs';

// Notificaciones propias de la app (CORREOS-DISENO.md, secciones B y D). HTML + texto plano a partir de los
// mismos bloques. Los asuntos son fijos y no llevan datos de personas ni de clientes: solo el nombre del
// espacio (truncado) en la invitación. `resourceLabel` nunca va al asunto y solo se muestra en los tipos
// que lo permiten, con una lista blanca estricta.
const ANTI = 'Rovaq nunca te pedirá tu contraseña por correo.';
const ANTI_EN = 'Rovaq will never ask for your password by email.';
/** Pie de seguridad por idioma (lo reutiliza el reporte semanal). */
export const antiFraude = idioma => (idiomaDe(idioma) === 'en' ? ANTI_EN : ANTI);

export const ROLES = Object.freeze({
  Propietario: Object.freeze({funcion: 'administrar el espacio, las personas y la facturación', descripcion: 'administra el espacio, las personas y la facturación'}),
  Analista: Object.freeze({funcion: 'consultar y analizar datos y preparar informes', descripcion: 'consulta y analiza datos, prepara informes'}),
  Operador: Object.freeze({funcion: 'atender solicitudes y tareas del día a día', descripcion: 'atiende solicitudes y tareas del día a día'}),
  Lector: Object.freeze({funcion: 'consultar los datos sin modificarlos', descripcion: 'consulta sin modificar'}),
});

/** Nombres de rol que se muestran en inglés. La clave canónica sigue siendo la española (es lo que guarda el producto). */
export const ROLES_EN = Object.freeze({
  Propietario: Object.freeze({nombre: 'Owner', funcion: 'manage the workspace, people and billing', descripcion: 'manages the workspace, people and billing'}),
  Analista: Object.freeze({nombre: 'Analyst', funcion: 'explore and analyze data and prepare reports', descripcion: 'explores and analyzes data, prepares reports'}),
  Operador: Object.freeze({nombre: 'Operator', funcion: 'handle day-to-day requests and tasks', descripcion: 'handles day-to-day requests and tasks'}),
  Lector: Object.freeze({nombre: 'Viewer', funcion: 'view data without changing it', descripcion: 'views data without changing it'}),
});
/** Acepta el nombre canónico en español o el nombre en inglés; devuelve la clave canónica o undefined. */
export const rolCanonico = valor => (ROLES[valor] ? valor : Object.keys(ROLES_EN).find(k => ROLES_EN[k].nombre === valor));

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

// Misma tabla en inglés, mismo orden y mismas banderas que `definitions`.
const definitionsEn = [
  ['digest.available', 'You have new notifications in Rovaq', 'See what changed in your workspace. Each notification shows its source.', 'Notifications', false, 'Your team has updates', 'Review your notifications and the resources your team has given you access to, inside your workspace.', 'View notifications', 'you use Rovaq and turned on these notifications'],
  ['membership.welcome', 'Your Rovaq workspace is ready', 'Three places to start: Today, Ask your data and Actions.', 'Welcome', false, 'Your workspace is ready', 'These are the three places to start:', 'Open Rovaq', 'you joined your Rovaq workspace for the first time. This is the only welcome email'],
  ['membership.invited', 'You have been invited to a Rovaq workspace', 'Accept the invitation to join the team. It is personal and must not be forwarded.', 'Team invitation', false, 'You have been invited to a workspace', 'Open the invitation to review the team and your access.', 'Accept invitation', 'someone in your organization entered this address when inviting people to their workspace'],
  ['brief.available', 'There is a new brief in Rovaq', 'Priorities, sources and pending decisions for your team.', 'Brief', false, 'Your team priorities, in one place', 'A brief is available. It brings together the analysis, its sources and the pending decisions. Each figure shows its period and source.', 'Open the brief', 'you have access to this brief and turned on its notifications'],
  ['intervention.assigned', 'You have an action assigned in Rovaq', 'Review the goal, the evidence and the next steps.', 'Action', false, 'An action is waiting for your review', 'An action has been assigned to you. Review its goal, the evidence and the next steps before recording it.', 'Open the action', 'this action is assigned to your user and you turned on its notifications'],
  ['connection.attention', 'A connection needs your attention', 'Until it is reviewed, some figures may be out of date.', 'Action required · Connection', true, 'Check the status of your connection', 'A connection in your organization needs review. Check its status and the available instructions before deciding how to proceed.', 'View connection status', 'you can review this connection and turned on its notifications'],
  ['processing.failed', 'An import finished with errors', 'Figures that depend on it may be partial.', 'Action required · Data', true, 'Review the pending import', 'An import could not be completed. Check the error and the available options. Rows with errors are not counted as zero, and figures that depend on them stay partial.', 'Review the errors', 'you have access to this import and turned on its notifications'],
];
const catalogEn = Object.freeze(definitionsEn.map(([type, subject, preheader, eyebrow, alert, heading, body, cta, reason]) => Object.freeze({...catalog.find(e => e.type === type), subject, preheader, eyebrow, alert, heading, body, cta, reason})));
export const definition = (type, idioma = 'es') => (idiomaDe(idioma) === 'en' ? catalogEn : catalog).find(entry => entry.type === type);
/** Catálogo completo en el idioma pedido (por omisión, el español de `catalog`). */
export const catalogFor = idioma => (idiomaDe(idioma) === 'en' ? catalogEn : catalog);

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
/** Cabeceras base por idioma; `headersBase('es')` equivale a `baseHeaders`. */
export const headersBase = idioma => ({'Content-Language': langDe(idioma), 'Auto-Submitted': 'auto-generated'});

const optional = (value, max, name) => (value === undefined || value === null || value === '' ? undefined : safeText(value, max, name));

/**
 * Renderiza una notificación.
 * @param {{type:string,appOrigin:string,ctaUrl:string,resourceLabel?:string,espacio?:string,rol?:string,invita?:string,vence?:string,unsubscribeUrl?:string,idioma?:'es'|'en'}} input
 *   `vence` es una fecha ISO. `invita`, `espacio` y `rol` solo se leen en bienvenida e invitación. `rol` acepta el nombre canónico
 *   en español o el nombre en inglés. `idioma` ('es' por omisión) elige asunto, cuerpo, pie, fechas y `lang`.
 * @returns {{subject:string,preheader:string,html:string,text:string,headers:Record<string,string>}}
 */
export function renderEmail({type, appOrigin, ctaUrl, resourceLabel = '', espacio, rol, invita, vence, unsubscribeUrl, idioma}) {
  const lang = idiomaDe(idioma), en = lang === 'en';
  const entry = definition(type, lang);
  if (!entry) throw Error('unknown_event');
  const url = appURL(ctaUrl, appOrigin);
  const prefs = appURL(new URL('/settings/notifications', appOrigin).href, appOrigin);
  if (resourceLabel !== '' && !entry.labelAllowed) throw Error('label_not_allowed');
  const label = resourceLabel === '' ? undefined : safeResourceLabel(resourceLabel);
  const space = optional(espacio, 40, 'space');
  const roleInput = optional(rol, 20, 'role');
  const roleKey = roleInput ? rolCanonico(roleInput) : undefined;
  if (roleInput && !roleKey) throw Error('invalid_role');
  const role = roleKey && en ? ROLES_EN[roleKey].nombre : roleKey;
  const roleInfo = roleKey ? (en ? ROLES_EN[roleKey] : ROLES[roleKey]) : undefined;

  let subject = entry.subject, h1 = entry.heading;
  const blocks = [], note = [];
  const footer = {strong: antiFraude(lang), motive: ''};
  if (type === 'membership.welcome') {
    if (space) h1 = en ? `Your ${space} workspace is ready` : `Tu espacio ${space} está listo`;
    blocks.push({type: 'p', text: role ? (en ? `You joined as **${role}**. ${entry.body}` : `Entraste con el rol de **${role}**. ${entry.body}`) : entry.body});
    blocks.push({type: 'list', rows: en ? [
      {label: 'Today', value: 'The weekly summary, with the figures that need attention.'},
      {label: 'Ask your data', value: 'Questions in plain language, with the source of every figure.'},
      {label: 'Actions', value: 'What Rovaq recommends and what is left to decide.'},
    ] : [
      {label: 'Hoy', value: 'El resumen de la semana con las cifras que requieren atención.'},
      {label: 'Pregúntale a tus datos', value: 'Preguntas en lenguaje natural, con la fuente de cada cifra.'},
      {label: 'Acciones', value: 'Lo que Rovaq recomienda y queda por decidir.'},
    ]});
    blocks.push({type: 'button', label: entry.cta, href: url});
    blocks.push({type: 'help', text: en ? 'Every figure shows its source, its period and whether it is observed, estimated or inferred. What we do not know also appears, under Data and confidence.' : 'Cada cifra indica su fuente, el periodo y si es observada, estimada o inferida. Lo que no sabemos también aparece, en Datos y confianza.'});
    footer.motive = en ? `You receive this email because you joined ${space ?? 'your Rovaq workspace'} for the first time. This is the only welcome email. [Choose which notifications to receive](${prefs})` : `Recibes este correo porque entraste por primera vez a ${space ?? 'tu espacio de Rovaq'}. Es el único correo de bienvenida. [Elegir qué avisos recibir](${prefs})`;
  } else if (type === 'membership.invited') {
    const who = optional(invita, 40, 'inviter');
    if (space) subject = en ? `You have been invited to ${truncate(space, 24)} on Rovaq` : `Te invitaron a ${truncate(space, 24)} en Rovaq`;
    h1 = en ? `${who ?? 'Someone'} invited you to ${space ?? 'a workspace'}` : `${who ?? 'Una persona'} te invitó a ${space ?? 'un espacio'}`;
    blocks.push({type: 'p', text: role ? (en ? `You will be able to ${roleInfo.funcion}, as **${role}**.` : `Podrás ${roleInfo.funcion}, con el rol de **${role}**.`) : (en ? 'You will be able to work with your team.' : 'Podrás colaborar con tu equipo.')});
    const rows = [];
    if (space) rows.push({label: en ? 'Workspace' : 'Espacio', value: space});
    if (role) rows.push({label: en ? 'Role' : 'Rol', value: `${role} · ${roleInfo.descripcion}`});
    if (who) rows.push({label: en ? 'Invited by' : 'Invitó', value: who});
    if (vence) rows.push({label: en ? 'Expires' : 'Vence', value: fmtFechaHora(vence, lang)});
    if (rows.length) blocks.push({type: 'list', rows});
    blocks.push({type: 'button', label: entry.cta, href: url});
    blocks.push({type: 'help', text: en ? 'If you do not have an account yet, you will create one when you accept. You can decline the invitation without consequences; just ignore this email.' : 'Si todavía no tienes cuenta, la crearás al aceptar. Puedes rechazar la invitación sin consecuencias; basta con ignorar este correo.'});
    note.push({type: 'help', text: en ? `Do not know ${who ?? 'the person inviting you'} or did not expect this? Do not open the link and let us know at [${IDENTITY.supportEmail}](mailto:${IDENTITY.supportEmail}).` : `¿No conoces a ${who ?? 'quien te invita'} o no esperabas esto? No abras el enlace y avísanos en [${IDENTITY.supportEmail}](mailto:${IDENTITY.supportEmail}).`});
    note.push({type: 'urlLine', lead: en ? 'If the button does not open, copy this address into your browser:' : 'Si el botón no abre, copia esta dirección en tu navegador:', url});
    footer.extra = en ? 'The link is personal; do not forward it.' : 'El enlace es personal; no lo reenvíes.';
    footer.motive = en ? `You receive this email because ${who ?? 'someone'} entered this address when inviting people to ${space ?? 'their workspace'}.` : `Recibes este correo porque ${who ?? 'una persona'} escribió esta dirección al invitar personas a ${space ?? 'su espacio'}.`;
  } else {
    blocks.push({type: 'p', text: entry.body});
    if (label) blocks.push({type: 'list', rows: [{label: en ? 'Resource' : 'Recurso', value: label}]});
    blocks.push({type: 'button', label: entry.cta, href: url});
    footer.motive = en ? `You receive this notification because ${entry.reason}. [Choose which notifications to receive](${prefs})` : `Recibes este aviso porque ${entry.reason}. [Elegir qué avisos recibir](${prefs})`;
  }
  const assetOrigin = new URL(appOrigin).origin;
  const {html, text} = renderLayout({go: false, idioma: lang, assetOrigin, subject, preheader: entry.preheader, eyebrow: entry.eyebrow, alert: entry.alert, h1, blocks, note, footer});
  const headers = {...headersBase(lang), ...(entry.kind === 'notification' && unsubscribeUrl ? unsubscribeHeaders(unsubscribeUrl, appOrigin) : {})};
  return {subject, preheader: entry.preheader, html, text, headers};
}
