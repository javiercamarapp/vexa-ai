import 'server-only';
import {serverPool} from '../../../lib/imports/server';
import {createBajaHandler} from '../../../../../../packages/notifications/baja-semanal.mjs';
import {crearAplicarBaja} from '../../../../../../packages/notifications/baja-db.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Baja de un clic del reporte semanal (L6). Pública y SIN sesión: la autoriza el token HMAC firmado (VEXA_UNSUBSCRIBE_SECRET). GET = enlace del correo; POST = List-Unsubscribe-Post (RFC 8058).
// Sin PII en registros: solo etiquetas fijas.
const handler=createBajaHandler({
 secret:process.env.VEXA_UNSUBSCRIBE_SECRET,
 appOrigin:process.env.VEXA_APP_ORIGIN||null,
 aplicar:args=>crearAplicarBaja({pool:serverPool()})(args),
 log:etiqueta=>console.info('baja '+etiqueta),
});
export const GET=handler;
export const POST=handler;
