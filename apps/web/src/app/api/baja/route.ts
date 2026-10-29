import 'server-only';
import {serverPool} from '../../../lib/imports/server';
import {createBajaHandler} from '../../../../../../packages/notifications/baja-semanal.mjs';
import {COOKIE_IDIOMA,resolverIdioma} from '../../../lib/i18n/idioma';
import {crearAplicarBaja} from '../../../../../../packages/notifications/baja-db.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Baja de un clic del reporte semanal (L6). Pública y SIN sesión: la autoriza el token HMAC firmado (VEXA_UNSUBSCRIBE_SECRET). GET = enlace del correo; POST = List-Unsubscribe-Post (RFC 8058).
// Sin PII en registros: solo etiquetas fijas.
const handler=createBajaHandler({
 secret:process.env.VEXA_UNSUBSCRIBE_SECRET,
 appOrigin:process.env.VEXA_APP_ORIGIN||null,
 aplicar:args=>crearAplicarBaja({pool:serverPool()})(args),
 log:etiqueta=>console.info('baja '+etiqueta),
 // Idioma de la página: ?lang= (el enlace del correo lo trae si el correo salió en inglés), luego la cookie rovaq_lang (resolverIdioma). Sin ninguno de los dos
 // se queda en español: hoy todos los correos de baja salen en español y el valor por omisión de la interfaz (inglés) no aplica a un enlace de correo sin sesión.
 idioma:(request:Request)=>{
  const parametro=new URL(request.url).searchParams.get('lang');
  const cookie=new RegExp('(?:^|;\\s*)'+COOKIE_IDIOMA+'=([^;]*)').exec(request.headers.get('cookie')??'')?.[1];
  return parametro===null&&cookie===undefined?'es':resolverIdioma({parametro,cookie});
 },
});
export const GET=handler;
export const POST=handler;
