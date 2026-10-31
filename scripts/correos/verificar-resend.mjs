#!/usr/bin/env node
// Verificacion de SOLO LECTURA del montaje de correo con Resend. No envia correo, no escribe en Resend, Supabase, Vercel ni DNS.
// Nunca imprime una clave, un secreto ni una URL de base de datos: solo si existen y si tienen la forma esperada.
//
//   node scripts/correos/verificar-resend.mjs [opciones]
//     --dominios acceso.rovaq.ai,avisos.rovaq.ai   dominios de envio (por omision esos dos)
//     --raiz rovaq.ai                               dominio raiz (DMARC y buzones)
//     --resolver 8.8.8.8                            resolvedor DNS publico (el del sistema a veces no resuelve rovaq.ai)
//     --env-file RUTA                               archivo con las variables (solo se mira si existen y su forma; chmod 600)
//     --vercel-dir RUTA                             carpeta enlazada a Vercel: corre `vercel env ls production` (solo nombres)
//     --resend-key-file RUTA                        clave de Resend en un archivo (lista dominios y webhooks)
//     --supabase-token-file RUTA                    token personal de Supabase en un archivo (lee la configuracion de Auth)
//     --project-ref REF                             proyecto de Supabase (por omision proyecto-ejemplo)
//     --probe-webhook ORIGEN                        POST sin firma a ORIGEN/api/webhooks/email: debe dar 400; 503 = sin configurar.
//                                                   Es opt-in porque una firma invalida se anota como evento de seguridad.
//   Salida: una linea por comprobacion (OK / FALLA / AVISO / OMITIDO). Codigo de salida 1 si hay alguna FALLA.
import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const run = promisify(execFile);
export const EVENTOS_WEBHOOK = Object.freeze(['email.delivered', 'email.bounced', 'email.complained', 'email.delivery_delayed', 'email.suppressed', 'email.failed']);
export const VARIABLES = Object.freeze({
  obligatorias: ['VEXA_EMAIL_MODE', 'RESEND_API_KEY', 'VEXA_EMAIL_FROM', 'VEXA_APP_ORIGIN', 'RESEND_WEBHOOK_SECRET', 'VEXA_EMAIL_DATABASE_URL'],
  opcionales: ['VEXA_EMAIL_REPLY_TO', 'VEXA_EMAIL_DATABASE_CA_PEM', 'VEXA_EMAIL_UNSUBSCRIBE_URL'],
});
const mailbox = v => typeof v === 'string' && v.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);

/** Forma esperada de cada variable. Devuelve null si esta bien o el motivo (sin incluir el valor). */
export function formaDe(nombre, valor) {
  if (typeof valor !== 'string' || valor === '') return 'vacia';
  switch (nombre) {
    case 'VEXA_EMAIL_MODE': return valor === 'resend' ? null : 'debe ser exactamente «resend» (mailpit es solo local)';
    case 'RESEND_API_KEY': return /^re_[A-Za-z0-9_-]+$/.test(valor) ? null : 'no empieza con re_ o trae caracteres raros';
    case 'RESEND_WEBHOOK_SECRET': return /^whsec_[A-Za-z0-9+/=_-]{16,}$/.test(valor) ? null : 'no tiene la forma whsec_...';
    case 'VEXA_EMAIL_FROM': case 'VEXA_EMAIL_REPLY_TO': return mailbox(valor) ? null : 'debe ser una direccion simple (sin nombre ni <>)';
    case 'VEXA_APP_ORIGIN': try { const u = new URL(valor); return u.protocol === 'https:' && u.pathname === '/' && !u.search && !u.hash ? null : 'debe ser un origen HTTPS sin ruta'; } catch { return 'no es una URL'; }
    case 'VEXA_EMAIL_UNSUBSCRIBE_URL': try { return new URL(valor).protocol === 'https:' ? null : 'debe ser HTTPS'; } catch { return 'no es una URL'; }
    case 'VEXA_EMAIL_DATABASE_URL': return /^postgres(ql)?:\/\//.test(valor) ? null : 'no es una URL de postgres';
    default: return null;
  }
}

export function leerEnvFile(texto) {
  const salida = {};
  for (const linea of texto.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(linea);
    if (m) salida[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return salida;
}

const quitaPunto = s => s.replace(/\.$/, '');
const sinComillas = s => s.replace(/"\s+"/g, '').replace(/^"|"$/g, '');

/** dig +short real; inyectable en pruebas. Devuelve lineas sin comillas. */
export async function digReal(tipo, nombre, resolver) {
  try {
    const {stdout} = await run('dig', ['+short', '+time=4', '+tries=1', tipo, nombre, '@' + resolver]);
    return stdout.split('\n').map(l => l.trim()).filter(Boolean).map(sinComillas);
  } catch { return null; }
}

export async function comprobarDns({dominios, raiz, dig}) {
  const r = [];
  const add = (estado, texto) => r.push({estado, texto});
  for (const d of dominios) {
    const dkim = await dig('TXT', `resend._domainkey.${d}`);
    if (dkim === null) { add('OMITIDO', `DNS ${d}: no se pudo consultar (¿sin red o sin dig?)`); continue; }
    add(dkim.some(x => /^p=[A-Za-z0-9+/=]{100,}$/.test(x.replace(/\s+/g, ''))) ? 'OK' : 'FALLA', `DNS ${d}: DKIM resend._domainkey.${d} ${dkim.length ? 'presente' : 'no existe'}`);
    if (dkim.some(x => /\s/.test(x))) add('AVISO', `DNS ${d}: el DKIM trae ESPACIOS dentro de la clave (copiado con saltos de linea). RFC 6376 los ignora, pero conviene recrear el registro sin espacios para que Resend lo verifique sin dudas`);
    const mx = await dig('MX', `send.${d}`);
    add(mx?.some(x => /feedback-smtp\.[a-z0-9-]+\.amazonses\.com\.?$/.test(x)) ? 'OK' : 'FALLA', `DNS ${d}: MX de rebotes send.${d} ${mx?.length ? 'presente' : 'no existe'}`);
    const spf = await dig('TXT', `send.${d}`);
    add(spf?.some(x => /^v=spf1\b.*include:amazonses\.com/.test(x)) ? 'OK' : 'FALLA', `DNS ${d}: SPF send.${d} ${spf?.length ? 'presente' : 'no existe'}`);
    const dmarcSub = await dig('TXT', `_dmarc.${d}`);
    const cname = await dig('CNAME', `rsend.${d}`);
    add(cname?.length ? 'OK' : 'AVISO', `DNS ${d}: CNAME rsend.${d} ${cname?.length ? 'presente' : 'ausente (lo entrego Resend en DNS-PARA-RESPONSABLE-CLIENTE; confirmar en el panel si es requerido)'}`);
    add(dmarcSub?.some(x => /^v=DMARC1/i.test(x)) ? 'OK' : 'AVISO', `DNS ${d}: DMARC propio _dmarc.${d} ${dmarcSub?.length ? 'presente' : 'ausente (hereda el de la raiz)'}`);
  }
  const dm = await dig('TXT', `_dmarc.${raiz}`);
  const pol = dm?.map(x => /;\s*p=(\w+)/i.exec(x)?.[1]).find(Boolean);
  add(pol ? 'OK' : 'FALLA', `DNS ${raiz}: DMARC de la raiz ${pol ? `presente (p=${pol.toLowerCase()})` : 'no existe: sin DMARC Gmail y Yahoo castigan a remitentes masivos'}`);
  if (dm?.some(x => /rua=mailto:[^;]*onsecureserver\.net/i.test(x))) add('AVISO', `DMARC ${raiz} es el predeterminado de GoDaddy (los reportes van a onsecureserver.net). Reemplazarlo por uno propio, p. ej. v=DMARC1; p=none; rua=mailto:dmarc@${raiz}`);
  if (pol === 'none') add('AVISO', `DMARC ${raiz} esta en p=none: correcto las dos primeras semanas; luego quarantine y despues reject`);
  const mxRaiz = await dig('MX', raiz);
  add(mxRaiz?.length ? 'OK' : 'AVISO', `DNS ${raiz}: ${mxRaiz?.length ? 'tiene MX (hay donde recibir soporte@ y seguridad@)' : 'SIN MX: soporte@ y seguridad@ (que salen en cada correo) no reciben nada'}`);
  return r;
}

export function comprobarVariables({nombres, valores}) {
  const r = [];
  for (const n of VARIABLES.obligatorias) {
    if (valores && n in valores) {
      const motivo = formaDe(n, valores[n]);
      r.push({estado: motivo ? 'FALLA' : 'OK', texto: `variable ${n}: ${motivo ? motivo : 'presente y con la forma esperada'}`});
    } else if (nombres) r.push({estado: nombres.has(n) ? 'OK' : 'FALLA', texto: `variable ${n}: ${nombres.has(n) ? 'definida en Vercel (forma no verificable)' : 'NO definida'}`});
    else r.push({estado: 'FALLA', texto: `variable ${n}: no se pudo comprobar`});
  }
  for (const n of VARIABLES.opcionales) {
    const hay = valores ? n in valores : nombres?.has(n);
    if (hay && valores) { const motivo = formaDe(n, valores[n]); r.push({estado: motivo ? 'FALLA' : 'OK', texto: `variable opcional ${n}: ${motivo ?? 'presente y con la forma esperada'}`}); }
    else r.push({estado: 'OMITIDO', texto: `variable opcional ${n}: ${hay ? 'definida' : 'no definida'}`});
  }
  if (valores?.VEXA_EMAIL_UNSUBSCRIBE_URL) r.push({estado: 'AVISO', texto: 'VEXA_EMAIL_UNSUBSCRIBE_URL definida: el endpoint de baja de un clic debe existir antes (ver CORREOS.md)'});
  return r;
}

async function api(fetchFn, url, token) {
  try {
    const res = await fetchFn(url, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/json'}});
    let cuerpo = null; try { cuerpo = await res.json(); } catch { /* sin cuerpo */ }
    return {status: res.status, cuerpo};
  } catch { return {status: 0, cuerpo: null}; }
}

export async function comprobarResend({token, dominios, fetchFn = fetch}) {
  const r = [];
  const dom = await api(fetchFn, 'https://api.resend.com/domains', token);
  let verificados = new Set();
  if (dom.status === 200) {
    const lista = dom.cuerpo?.data ?? [];
    for (const d of dominios) {
      const f = lista.find(x => x.name === d);
      r.push({estado: f?.status === 'verified' ? 'OK' : 'FALLA', texto: `Resend dominio ${d}: ${f ? f.status + (f.region ? ` (${f.region})` : '') : 'no esta agregado a esta cuenta'}`});
      if (f?.status === 'verified') verificados.add(d);
    }
  } else if (dom.status === 401 || dom.status === 403) r.push({estado: 'OMITIDO', texto: `Resend dominios: la clave no puede listar dominios (HTTP ${dom.status}; las claves de solo envio no pueden). Revisar en el panel o usar una clave de acceso completo temporal`});
  else r.push({estado: 'FALLA', texto: `Resend dominios: respuesta inesperada (HTTP ${dom.status})`});
  const wh = await api(fetchFn, 'https://api.resend.com/webhooks', token);
  if (wh.status === 200) {
    const hooks = wh.cuerpo?.data ?? [];
    const hook = hooks.find(h => /\/api\/webhooks\/email$/.test(h.endpoint ?? ''));
    if (!hook) r.push({estado: 'FALLA', texto: 'Resend webhook: no hay ninguno que termine en /api/webhooks/email'});
    else {
      const faltan = EVENTOS_WEBHOOK.filter(e => !(hook.events ?? []).includes(e));
      r.push({estado: faltan.length ? 'FALLA' : 'OK', texto: `Resend webhook ${new URL(hook.endpoint).origin}: ${hook.status ?? 'estado desconocido'}${faltan.length ? '; faltan eventos ' + faltan.join(', ') : '; eventos completos'}`});
    }
  } else r.push({estado: 'OMITIDO', texto: `Resend webhooks: no se pudieron leer (HTTP ${wh.status})`});
  return {resultados: r, verificados};
}

export async function comprobarSupabase({token, ref, verificados, fetchFn = fetch}) {
  const r = [];
  const res = await api(fetchFn, `https://api.supabase.com/v1/projects/${ref}/config/auth`, token);
  if (res.status !== 200 || !res.cuerpo) return [{estado: 'FALLA', texto: `Supabase Auth: no se pudo leer la configuracion (HTTP ${res.status})`}];
  const c = res.cuerpo;
  const ok = (cond, texto) => r.push({estado: cond ? 'OK' : 'FALLA', texto});
  ok(c.smtp_host === 'smtp.resend.com', `Supabase SMTP host: ${c.smtp_host ? (c.smtp_host === 'smtp.resend.com' ? 'smtp.resend.com' : 'otro (' + c.smtp_host + ')') : 'VACIO: usa el SMTP integrado (limite de 2 correos por hora, solo a miembros de la organizacion)'}`);
  ok(String(c.smtp_port) === '465', `Supabase SMTP puerto: ${c.smtp_port ?? 'vacio'} (esperado 465)`);
  ok(c.smtp_user === 'resend', `Supabase SMTP usuario: ${c.smtp_user ? 'distinto de «resend»' : 'vacio'}`);
  r.push({estado: c.smtp_pass ? 'OK' : 'AVISO', texto: `Supabase SMTP contrasena: ${c.smtp_pass ? 'definida (no se muestra)' : 'la API no la devuelve o esta vacia; confirmar con una prueba de entrega'}`});
  const dominioAdmin = String(c.smtp_admin_email ?? '').split('@')[1];
  ok(mailbox(c.smtp_admin_email) && (verificados.size === 0 ? !!dominioAdmin : verificados.has(dominioAdmin)), `Supabase remitente: ${c.smtp_admin_email ? 'usa ' + dominioAdmin : 'vacio'}${verificados.size && dominioAdmin && !verificados.has(dominioAdmin) ? ' (dominio NO verificado en Resend)' : ''}`);
  ok(Number(c.rate_limit_email_sent) >= 300, `Supabase limite de correos por hora: ${c.rate_limit_email_sent ?? 'sin dato'} (con SMTP propio debe subirse a 300 o mas)`);
  ok(Number(c.mailer_otp_exp) === 3600, `Supabase vigencia de enlaces/codigos: ${c.mailer_otp_exp ?? 'sin dato'} s (los textos dicen «1 hora» = 3600)`);
  ok(/^https:\/\//.test(c.site_url ?? ''), `Supabase Site URL: ${c.site_url ? new URL(c.site_url).origin : 'vacio'}`);
  ok(c.mailer_autoconfirm === false, `Supabase confirmacion de correo obligatoria: ${c.mailer_autoconfirm === false ? 'si' : 'NO (mailer_autoconfirm no es false)'}`);
  ok(c.disable_signup === true, `Supabase registro publico cerrado: ${c.disable_signup === true ? 'si' : 'NO'}`);
  const lista = String(c.uri_allow_list ?? '');
  for (const ruta of ['/auth/callback', '/auth/email/complete', '/auth/invitations/']) ok(lista.includes(ruta), `Supabase redirect permitido ${ruta}: ${lista.includes(ruta) ? 'si' : 'falta'}`);
  const sinPlantilla = ['magic_link', 'recovery', 'confirmation', 'invite', 'email_change', 'reauthentication'].filter(k => !String(c['mailer_templates_' + k + '_content'] ?? '').includes('Rovaq'));
  ok(sinPlantilla.length === 0, `Supabase plantillas de Rovaq aplicadas: ${sinPlantilla.length ? 'faltan ' + sinPlantilla.join(', ') : 'las 6 acciones'}`);
  return r;
}

export async function sondearWebhook({origen, fetchFn = fetch}) {
  try {
    const url = new URL('/api/webhooks/email', origen);
    if (url.protocol !== 'https:') return [{estado: 'FALLA', texto: 'webhook: el origen debe ser HTTPS'}];
    const res = await fetchFn(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
    const codigo = (await res.json().catch(() => ({}))).code;
    if (res.status === 400 && codigo === 'email_webhook_invalid') return [{estado: 'OK', texto: `webhook ${url.origin}: configurado (rechaza lo que no trae firma, 400)`}];
    if (res.status === 503) return [{estado: 'FALLA', texto: `webhook ${url.origin}: 503 ${codigo ?? ''}; faltan RESEND_WEBHOOK_SECRET o VEXA_EMAIL_DATABASE_URL`}];
    return [{estado: 'FALLA', texto: `webhook ${url.origin}: respuesta inesperada HTTP ${res.status} ${codigo ?? ''}`}];
  } catch { return [{estado: 'FALLA', texto: 'webhook: no se pudo conectar'}]; }
}

const leerArchivo = ruta => fs.readFileSync(ruta, 'utf8').trim();
function argumentos(argv) {
  const a = {}; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (k.startsWith('--')) { const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; a[k.slice(2)] = v; } }
  return a;
}

export async function principal(argv = process.argv.slice(2), io = {dig: digReal, fetchFn: fetch, log: console.log}) {
  const a = argumentos(argv);
  const dominios = String(a.dominios ?? 'acceso.rovaq.ai,avisos.rovaq.ai').split(',').map(s => s.trim()).filter(Boolean);
  const raiz = String(a.raiz ?? 'rovaq.ai');
  const resolver = String(a.resolver ?? '8.8.8.8');
  const todo = [];
  todo.push(...await comprobarDns({dominios, raiz, dig: (t, n) => io.dig(t, n, resolver)}));
  let valores = null, nombres = null;
  if (a['env-file']) valores = leerEnvFile(leerArchivo(a['env-file']));
  if (a['vercel-dir']) { try { const {stdout} = await run('vercel', ['env', 'ls', 'production'], {cwd: a['vercel-dir']}); nombres = new Set(stdout.split('\n').map(l => l.trim().split(/\s+/)[0]).filter(x => /^[A-Z][A-Z0-9_]+$/.test(x))); } catch { todo.push({estado: 'OMITIDO', texto: 'Vercel: no se pudo listar variables (¿sesion o carpeta no enlazada?)'}); } }
  if (valores || nombres) todo.push(...comprobarVariables({nombres, valores}));
  else todo.push({estado: 'OMITIDO', texto: 'variables: pasa --env-file o --vercel-dir para comprobarlas'});
  let verificados = new Set();
  if (a['resend-key-file']) { const x = await comprobarResend({token: leerArchivo(a['resend-key-file']), dominios, fetchFn: io.fetchFn}); todo.push(...x.resultados); verificados = x.verificados; }
  else todo.push({estado: 'OMITIDO', texto: 'Resend: pasa --resend-key-file para leer dominios y webhook'});
  if (a['supabase-token-file']) todo.push(...await comprobarSupabase({token: leerArchivo(a['supabase-token-file']), ref: String(a['project-ref'] ?? 'proyecto-ejemplo'), verificados, fetchFn: io.fetchFn}));
  else todo.push({estado: 'OMITIDO', texto: 'Supabase: pasa --supabase-token-file para leer la configuracion de Auth'});
  if (typeof a['probe-webhook'] === 'string') todo.push(...await sondearWebhook({origen: a['probe-webhook'], fetchFn: io.fetchFn}));
  else todo.push({estado: 'OMITIDO', texto: 'webhook: pasa --probe-webhook https://ORIGEN para sondearlo (opt-in)'});
  for (const x of todo) io.log(`${x.estado.padEnd(7)} ${x.texto}`);
  const fallas = todo.filter(x => x.estado === 'FALLA').length;
  io.log(`\n${todo.filter(x => x.estado === 'OK').length} OK, ${fallas} FALLA, ${todo.filter(x => x.estado === 'AVISO').length} AVISO, ${todo.filter(x => x.estado === 'OMITIDO').length} OMITIDO. Solo lectura: no se envio nada ni se cambio nada.`);
  return fallas ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await principal();
