// Entrega apagada por defecto. El transporte prepara el reporte persistido,
// revalida acceso/baja/supresión y registra la aceptación para conciliar recibos.
export function crearEntregaSemanal({email}) {
  const entregar = async ({tenantId, userId, headers, idempotencyKey, signal}) => {
    if (!(await email.configured())) return {ok: false, motivo: 'no_configurado'};
    const rec = await email.resolveRecipient({tenantId, userId}, {signal});
    if (!rec || rec.emailVerified !== true || typeof rec.email !== 'string') return {ok: false, motivo: 'sin_destinatario'};
    if (typeof email.sendWeekly !== 'function') return {ok: false, motivo: 'no_configurado'};
    const r = await email.sendWeekly({recipient: rec, headers, idempotencyKey, signal});
    if (r.kind !== 'accepted') return {ok: false, motivo: r.kind};
    return {ok: true, providerId: r.providerId};
  };
  entregar.close = async () => { await email.close?.(); };
  return entregar;
}
/** null salvo VEXA_WEEKLY_SEND==='enabled' con transporte y llave válidos. El flag es explícito: no se enciende solo por tener llaves de correo. */
export async function entregaDesdeEntorno(env = process.env) {
  if (env.VEXA_WEEKLY_SEND !== 'enabled' || env.VEXA_EMAIL_MODE !== 'resend') return null;
  const {createTransports} = await import('./email.mjs');
  const t = await createTransports(env);
  if (!t.email) return null;
  return crearEntregaSemanal({email: t.email});
}
