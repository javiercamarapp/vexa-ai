import 'server-only';
import {createWeeklyHostedHandler} from '../../../../../../../packages/notifications/weekly-hosted.mjs';
import {ejecutarSemanal} from '../../../../lib/weekly/server';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
// Reporte semanal (L5). Interno: solo con VEXA_WORKER_TRIGGER_SECRET (CRON_SECRET igual), como /api/internal/crm. Por defecto GENERA la vista previa y la registra en weekly_report_outbox SIN enviar;
// el envío real exige VEXA_WEEKLY_SEND=enabled (apagado: el dominio de correo aún no está verificado). NO está programado en vercel.json: activarlo es una decisión de Javier.
const handler=createWeeklyHostedHandler({secret:process.env.VEXA_WORKER_TRIGGER_SECRET,timeoutMs:55000,ejecutar:ejecutarSemanal});
export const GET=handler;
export const POST=handler;
