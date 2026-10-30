import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {comprobarDns, comprobarVariables, comprobarResend, comprobarSupabase, sondearWebhook, formaDe, leerEnvFile, principal, EVENTOS_WEBHOOK} from '../../../scripts/correos/verificar-resend.mjs';

// Verificador de solo lectura: todo con DNS y HTTP simulados. Nada sale a la red.
const KEY = 'p=' + 'A'.repeat(216);
const dnsOk = (tipo, nombre) => ({
  'TXT resend._domainkey.acceso.rovaq.ai': [KEY], 'MX send.acceso.rovaq.ai': ['10 feedback-smtp.us-east-1.amazonses.com.'],
  'TXT send.acceso.rovaq.ai': ['v=spf1 include:amazonses.com ~all'], 'CNAME rsend.acceso.rovaq.ai': ['send.forge.rmta.net.'],
  'TXT _dmarc.acceso.rovaq.ai': ['v=DMARC1; p=none; rua=mailto:dmarc@rovaq.ai'],
  'TXT _dmarc.rovaq.ai': ['v=DMARC1; p=none; rua=mailto:dmarc@rovaq.ai'], 'MX rovaq.ai': ['1 smtp.google.com.'],
}[`${tipo} ${nombre}`] ?? []);
const por = (r, frag) => r.filter(x => x.texto.includes(frag));

test('DNS completo: sin FALLA; falta el DKIM: FALLA; DKIM con espacios: OK pero con AVISO', async () => {
  const bien = await comprobarDns({dominios: ['acceso.rovaq.ai'], raiz: 'rovaq.ai', dig: async (t, n) => dnsOk(t, n)});
  assert.deepEqual(bien.filter(x => x.estado === 'FALLA'), []);
  const sin = await comprobarDns({dominios: ['acceso.rovaq.ai'], raiz: 'rovaq.ai', dig: async (t, n) => (t === 'TXT' && n.startsWith('resend._domainkey') ? [] : dnsOk(t, n))});
  assert.equal(por(sin, 'DKIM resend._domainkey')[0].estado, 'FALLA');
  const esp = await comprobarDns({dominios: ['acceso.rovaq.ai'], raiz: 'rovaq.ai', dig: async (t, n) => (t === 'TXT' && n.startsWith('resend._domainkey') ? ['p=' + 'A'.repeat(100) + ' ' + 'B'.repeat(100)] : dnsOk(t, n))});
  assert.equal(por(esp, 'DKIM resend._domainkey')[0].estado, 'OK');
  assert.equal(por(esp, 'ESPACIOS')[0].estado, 'AVISO');
});

test('DNS: sin DMARC en la raiz y sin MX son FALLA/AVISO; el DMARC de GoDaddy se senala; sin red es OMITIDO', async () => {
  const r = await comprobarDns({dominios: ['acceso.rovaq.ai'], raiz: 'rovaq.ai', dig: async (t, n) => (n === '_dmarc.rovaq.ai' || (t === 'MX' && n === 'rovaq.ai') ? [] : dnsOk(t, n))});
  assert.equal(por(r, 'DMARC de la raiz')[0].estado, 'FALLA');
  assert.equal(por(r, 'SIN MX')[0].estado, 'AVISO');
  const gd = await comprobarDns({dominios: [], raiz: 'rovaq.ai', dig: async (t, n) => (n === '_dmarc.rovaq.ai' ? ['v=DMARC1; p=quarantine; rua=mailto:dmarc_rua@onsecureserver.net;'] : dnsOk(t, n))});
  assert.equal(por(gd, 'predeterminado de GoDaddy')[0].estado, 'AVISO');
  const off = await comprobarDns({dominios: ['acceso.rovaq.ai'], raiz: 'rovaq.ai', dig: async () => null});
  assert.equal(off[0].estado, 'OMITIDO');
});

test('formas de variables: valida las correctas y rechaza las peligrosas sin eco del valor', () => {
  assert.equal(formaDe('VEXA_EMAIL_MODE', 'resend'), null);
  assert.ok(formaDe('VEXA_EMAIL_MODE', 'mailpit'));
  assert.equal(formaDe('RESEND_API_KEY', 're_abc123_DEF'), null);
  assert.ok(formaDe('RESEND_API_KEY', 'sk_live_x'));
  assert.equal(formaDe('RESEND_WEBHOOK_SECRET', 'whsec_' + 'a'.repeat(30)), null);
  assert.ok(formaDe('RESEND_WEBHOOK_SECRET', 'corto'));
  assert.equal(formaDe('VEXA_EMAIL_FROM', 'avisos@avisos.rovaq.ai'), null);
  assert.ok(formaDe('VEXA_EMAIL_FROM', 'Rovaq <avisos@avisos.rovaq.ai>'));
  assert.equal(formaDe('VEXA_APP_ORIGIN', 'https://app.rovaq.ai'), null);
  assert.ok(formaDe('VEXA_APP_ORIGIN', 'https://app.rovaq.ai/ruta'));
  assert.ok(formaDe('VEXA_APP_ORIGIN', 'http://app.rovaq.ai'));
  assert.ok(formaDe('VEXA_EMAIL_DATABASE_URL', 'mysql://x'));
  assert.ok(formaDe('RESEND_API_KEY', ''));
  for (const [n, v] of [['RESEND_API_KEY', 'sk_live_SECRETO123'], ['VEXA_EMAIL_DATABASE_URL', 'mysql://u:SECRETO123@h/db']]) assert.doesNotMatch(String(formaDe(n, v)), /SECRETO123/);
});

test('variables: por valores o por nombres; las obligatorias que faltan son FALLA', () => {
  const buenos = {VEXA_EMAIL_MODE: 'resend', RESEND_API_KEY: 're_x1', VEXA_EMAIL_FROM: 'a@b.co', VEXA_APP_ORIGIN: 'https://app.rovaq.ai', RESEND_WEBHOOK_SECRET: 'whsec_' + 'a'.repeat(30), VEXA_EMAIL_DATABASE_URL: 'postgresql://u:p@h/d'};
  assert.deepEqual(comprobarVariables({valores: buenos}).filter(x => x.estado === 'FALLA'), []);
  const sinSecreto = {...buenos}; delete sinSecreto.RESEND_WEBHOOK_SECRET;
  assert.equal(comprobarVariables({valores: sinSecreto}).filter(x => x.estado === 'FALLA').length, 1);
  assert.equal(comprobarVariables({nombres: new Set(['VEXA_EMAIL_MODE'])}).filter(x => x.estado === 'FALLA').length, 5);
  assert.deepEqual(leerEnvFile('# c\nexport A=1\nB="dos"\n x = 3 \nlower=1\n'), {A: '1', B: 'dos'});
});

const respuesta = (status, cuerpo) => ({status, json: async () => cuerpo});
test('Resend: dominios verificados y webhook con los seis eventos; clave de solo envio es OMITIDO, no FALLA', async () => {
  const fetchFn = async url => String(url).endsWith('/domains')
    ? respuesta(200, {data: [{name: 'acceso.rovaq.ai', status: 'verified', region: 'us-east-1'}, {name: 'avisos.rovaq.ai', status: 'pending'}]})
    : respuesta(200, {data: [{endpoint: 'https://app.rovaq.ai/api/webhooks/email', status: 'enabled', events: EVENTOS_WEBHOOK.slice(0, 5)}]});
  const { resultados, verificados } = await comprobarResend({token: 're_x', dominios: ['acceso.rovaq.ai', 'avisos.rovaq.ai'], fetchFn});
  assert.deepEqual([...verificados], ['acceso.rovaq.ai']);
  assert.equal(por(resultados, 'avisos.rovaq.ai')[0].estado, 'FALLA');
  assert.match(por(resultados, 'faltan eventos')[0].texto, /email\.failed/);
  const restringida = await comprobarResend({token: 're_x', dominios: ['acceso.rovaq.ai'], fetchFn: async () => respuesta(401, {name: 'restricted_api_key'})});
  assert.deepEqual(restringida.resultados.map(x => x.estado), ['OMITIDO', 'OMITIDO']);
});

const authBueno = {smtp_host: 'smtp.resend.com', smtp_port: '465', smtp_user: 'resend', smtp_pass: 'x', smtp_admin_email: 'acceso@acceso.rovaq.ai', rate_limit_email_sent: 300, mailer_otp_exp: 3600, site_url: 'https://app.rovaq.ai', mailer_autoconfirm: false, disable_signup: true, uri_allow_list: 'https://app.rovaq.ai/auth/callback,https://app.rovaq.ai/auth/email/complete,https://app.rovaq.ai/auth/invitations/*',
  mailer_templates_magic_link_content: 'Rovaq', mailer_templates_recovery_content: 'Rovaq', mailer_templates_confirmation_content: 'Rovaq', mailer_templates_invite_content: 'Rovaq', mailer_templates_email_change_content: 'Rovaq', mailer_templates_reauthentication_content: 'Rovaq'};
test('Supabase Auth: configuracion completa pasa; SMTP integrado, limite bajo y registro abierto fallan', async () => {
  const ok = await comprobarSupabase({token: 't', ref: 'r', verificados: new Set(['acceso.rovaq.ai']), fetchFn: async () => respuesta(200, authBueno)});
  assert.deepEqual(ok.filter(x => x.estado === 'FALLA'), []);
  const mal = await comprobarSupabase({token: 't', ref: 'r', verificados: new Set(), fetchFn: async () => respuesta(200, {...authBueno, smtp_host: null, rate_limit_email_sent: 2, disable_signup: false, mailer_templates_invite_content: ''})});
  const fallas = mal.filter(x => x.estado === 'FALLA').map(x => x.texto).join('\n');
  assert.match(fallas, /integrado/); assert.match(fallas, /limite de correos/); assert.match(fallas, /registro publico/); assert.match(fallas, /faltan invite/);
  const dominioAjeno = await comprobarSupabase({token: 't', ref: 'r', verificados: new Set(['otro.com']), fetchFn: async () => respuesta(200, authBueno)});
  assert.match(dominioAjeno.filter(x => x.estado === 'FALLA').map(x => x.texto).join(), /NO verificado/);
  assert.equal((await comprobarSupabase({token: 't', ref: 'r', verificados: new Set(), fetchFn: async () => respuesta(401, null)}))[0].estado, 'FALLA');
});

test('sondeo del webhook: 400 invalido = configurado; 503 = sin configurar; solo HTTPS', async () => {
  const f = (status, code) => async (url, init) => { assert.equal(init.method, 'POST'); assert.equal(init.body, '{}'); return respuesta(status, {code}); };
  assert.equal((await sondearWebhook({origen: 'https://app.rovaq.ai', fetchFn: f(400, 'email_webhook_invalid')}))[0].estado, 'OK');
  assert.equal((await sondearWebhook({origen: 'https://app.rovaq.ai', fetchFn: f(503, 'email_webhook_unconfigured')}))[0].estado, 'FALLA');
  assert.equal((await sondearWebhook({origen: 'http://app.rovaq.ai', fetchFn: f(400, 'email_webhook_invalid')}))[0].estado, 'FALLA');
});

test('principal: solo lectura, no imprime ninguna clave ni secreto y devuelve 1 si hay FALLA', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f6-'));
  const envf = path.join(dir, 'env'), kf = path.join(dir, 'k'), tf = path.join(dir, 't');
  fs.writeFileSync(envf, 'VEXA_EMAIL_MODE=resend\nRESEND_API_KEY=re_SECRETO_ENV_123\nRESEND_WEBHOOK_SECRET=whsec_SECRETO_WH_0123456789abcdef\nVEXA_EMAIL_DATABASE_URL=postgresql://u:SECRETO_DB@h/d\nVEXA_EMAIL_FROM=a@acceso.rovaq.ai\nVEXA_APP_ORIGIN=https://app.rovaq.ai\n');
  fs.writeFileSync(kf, 're_SECRETO_KEYFILE_999'); fs.writeFileSync(tf, 'sbp_SECRETO_TOKEN_777');
  const metodos = []; const lineas = [];
  const fetchFn = async (url, init = {}) => { metodos.push(init.method ?? 'GET'); assert.ok(!JSON.stringify(init.headers ?? {}).includes('SECRETO_ENV')); return String(url).includes('supabase') ? respuesta(200, authBueno) : respuesta(200, {data: []}); };
  const code = await principal(['--dominios', 'acceso.rovaq.ai', '--env-file', envf, '--resend-key-file', kf, '--supabase-token-file', tf], {dig: async (t, n) => dnsOk(t, n), fetchFn, log: l => lineas.push(l)});
  const salida = lineas.join('\n');
  assert.doesNotMatch(salida, /SECRETO/);
  assert.ok(metodos.every(m => m === 'GET'), 'solo GET');
  assert.equal(code, 1); // el dominio no aparece verificado en Resend (lista vacia) y no hay webhook
  assert.match(salida, /Solo lectura/);
  fs.rmSync(dir, {recursive: true});
});
