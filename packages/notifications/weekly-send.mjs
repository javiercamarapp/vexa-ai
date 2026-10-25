// Entrega REAL del reporte semanal (L5): APAGADA por defecto. Solo existe con VEXA_WEEKLY_SEND==='enabled' y el transporte de correo configurado (el dominio de correo AÚN no está verificado).
// Reutiliza el transporte de correo existente para resolver el destinatario (correo verificado) y envía el HTML/TEXTO ya guardado en la vista previa, con las cabeceras de baja de un clic.
export function crearEntregaSemanal({email, sdk, from, replyTo}) {
  return async ({tenantId, userId, subject, html, text, headers, idempotencyKey, signal}) => {
    if (!(await email.configured())) return {ok: false, motivo: 'no_configurado'};
    const rec = await email.resolveRecipient({tenantId, userId}, {signal});
    if (!rec || rec.emailVerified !== true || typeof rec.email !== 'string') return {ok: false, motivo: 'sin_destinatario'};
    const r = await sdk.emails.send({from, ...(replyTo ? {replyTo} : {}), to: [rec.email], subject, html, text, headers}, {idempotencyKey, signal, redirect: 'error'});
    if (r.error) return {ok: false, motivo: 'rechazado'};
    return {ok: true, providerId: r.data?.id};
  };
}
/** null salvo VEXA_WEEKLY_SEND==='enabled' con transporte y llave válidos. El flag es explícito: no se enciende solo por tener llaves de correo. */
export async function entregaDesdeEntorno(env = process.env) {
  if (env.VEXA_WEEKLY_SEND !== 'enabled') return null;
  const {createTransports} = await import('./email.mjs');
  const t = await createTransports(env);
  if (!t.email || env.VEXA_EMAIL_MODE !== 'resend') return null;
  const {Resend} = await import('resend');
  return crearEntregaSemanal({email: t.email, sdk: new Resend(env.RESEND_API_KEY, {baseUrl: 'https://api.resend.com'}), from: env.VEXA_EMAIL_FROM, replyTo: env.VEXA_EMAIL_REPLY_TO});
}
