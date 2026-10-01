import {brand} from '../../apps/web/src/lib/brand.mjs';
// Selectively adopted from bank 1a0df4e4, adjusted to the authorized notification centre.
const definitions = [
  ['digest.available', 'Tienes avisos en VEXA', 'Tu equipo tiene novedades', 'Consulta tus avisos y los recursos autorizados dentro de tu espacio de trabajo.', 'Ver avisos', 'eres usuario de VEXA y activaste estos avisos', 'notifications'],
  ['membership.welcome', 'Bienvenido a VEXA', 'Tu acceso está listo', 'Ya puedes entrar a tu espacio de trabajo y consultar los recursos que tu equipo te haya autorizado.', 'Entrar a VEXA', 'tu acceso a VEXA está activo', 'memberships'],
  ['membership.invited', 'Tienes una invitación a VEXA', 'Tu equipo te invita a colaborar', 'Una persona propietaria de tu organización ha creado una invitación para ti. Abre VEXA para revisar y aceptar el acceso con la cuenta invitada.', 'Revisar invitación', 'una persona propietaria de tu organización te ha invitado explícitamente', 'invitations'],
  ['brief.available', 'Tu brief está disponible en VEXA', 'Las prioridades, en un solo lugar', 'Hay un brief disponible para tu equipo. Consulta el análisis, sus fuentes y las decisiones pendientes dentro de VEXA.', 'Abrir brief', 'tienes acceso a este brief y activaste sus avisos', 'briefs'],
  ['intervention.assigned', 'Tienes una intervención asignada en VEXA', 'Una acción espera tu revisión', 'Se te ha asignado una intervención. Revisa su objetivo, la evidencia y los próximos pasos antes de registrar una acción.', 'Ver intervención', 'esta intervención está asignada a tu usuario y activaste sus avisos', 'interventions'],
  ['connection.attention', 'Una conexión requiere atención en VEXA', 'Revisa el estado de tu conexión', 'Una conexión de tu organización necesita revisión. Consulta el estado y las instrucciones disponibles en VEXA para decidir cómo continuar.', 'Revisar conexión', 'tienes permiso para revisar esta conexión y activaste sus avisos', 'connections'],
  ['processing.failed', 'Un procesamiento no pudo completarse en VEXA', 'Revisa el procesamiento pendiente', 'VEXA no pudo completar un procesamiento. Abre su detalle para consultar el error y las opciones disponibles. No se presupone que los datos estén completos.', 'Ver procesamiento', 'tienes acceso a este procesamiento y activaste sus avisos', 'jobs'],
];
export const catalog = Object.freeze(definitions.map(([type, subject, heading, body, cta, reason, route]) => Object.freeze({ type, subject, heading, body, cta, reason, route, templateImplemented: true, connected: false })));
export const definition = type => catalog.find(entry => entry.type === type);
const escape = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function appURL(value, appOrigin) {
  if (typeof value !== 'string' || /[\x00-\x20\x7f\\]/.test(value) || /%(?:0[ad]|5c)/i.test(value)) throw Error('invalid_url');
  const base = new URL(appOrigin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('invalid_origin');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== base.origin || url.username || url.password) throw Error('invalid_url');
  return url.href;
}
export function renderEmail({ type, appOrigin, ctaUrl, resourceLabel = '' }) {
  const entry = definition(type);
  if (!entry) throw Error('unknown_event');
  if (typeof resourceLabel !== 'string' || resourceLabel.length > 180 || /[\x00-\x1f\x7f]/.test(resourceLabel)) throw Error('invalid_label');
  const url = appURL(ctaUrl, appOrigin);
  const prefs = appURL(new URL('/settings/notifications', appOrigin).href, appOrigin);
  const preheader = entry.body;
  const reason = `Recibes este aviso porque ${entry.reason}.`;
  const text = `VEXA\n\n${entry.heading}\n\n${entry.body}${resourceLabel ? '\n\nRecurso: ' + resourceLabel : ''}\n\n${entry.cta}: ${url}\n\nSi el botón no funciona, copia la dirección anterior en tu navegador.\n\n${reason}\nPreferencias de notificaciones: ${prefs}\nTu acceso se comprueba de nuevo al abrir VEXA.`;
  const asset=brand();
  const logo=asset.logoPath?`<img src="${escape(appURL(new URL(asset.logoPath,appOrigin).href,appOrigin))}" width="${asset.width}" height="${asset.height}" alt="VEXA AI" style="display:block;margin:0 auto;max-width:100%;height:auto;border:0;">`:'<span style="font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;letter-spacing:-2px;font-weight:800;color:#111111;">VEXA<span style="color:#166534;">.</span></span>';
  const html = `<!doctype html><html lang="es" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(entry.subject)}</title></head><body style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;"><div lang="es" dir="ltr" style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escape(preheader)}</div><table lang="es" dir="ltr" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#ffffff;"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;"><tr><td align="center" style="padding:0 0 24px;text-align:center;">${logo}</td></tr><tr><td style="padding:32px 24px;background:#ffffff;border:1px solid #cad4c8;border-radius:12px;"><h1 style="margin:0 0 20px;font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.5px;color:#111111;">${escape(entry.heading)}</h1><p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#111111;">${escape(entry.body)}</p>${resourceLabel ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.5;overflow-wrap:anywhere;"><strong>Recurso:</strong> ${escape(resourceLabel)}</p>` : ''}<table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr><td bgcolor="#166534" style="border-radius:6px;mso-padding-alt:14px 24px;"><a href="${escape(url)}" style="display:inline-block;padding:14px 24px;border:1px solid #166534;border-radius:6px;background:#166534;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;line-height:24px;">${escape(entry.cta)}</a></td></tr></table><p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#404040;">Si el botón no funciona, abre esta dirección:<br><a href="${escape(url)}" style="color:#166534;word-break:break-all;">${escape(url)}</a></p></td></tr><tr><td style="padding:24px 8px;text-align:center;font-size:14px;line-height:1.6;color:#404040;"><p style="margin:0 0 12px;">${escape(reason)}</p><p style="margin:0 0 12px;"><a href="${escape(prefs)}" style="color:#166534;text-decoration:underline;">Preferencias de notificaciones</a></p><p style="margin:0;">VEXA AI · Tu acceso se comprueba de nuevo al abrir VEXA.</p></td></tr></table></td></tr></table></body></html>`;
  return { subject: entry.subject, preheader, html, text };
}
