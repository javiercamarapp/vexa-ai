import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ALLOWED_HOSTS, CONTRAST_PAIRS, IDENTITY, OTP_EXPIRY_SECONDS, TOKENS, VIGENCIA, contrastRatio, fmtMonto, renderLayout, safeText} from '../email-system.mjs';
import {catalog as appCatalog, renderEmail, safeResourceLabel, unsubscribeHeaders} from '../email-template.mjs';
import {renderWeeklyReport} from '../email-weekly.mjs';
import {catalog as authCatalog, GO_ACTIONS, managementPatch, localConfig, render as renderAuth, renderText as renderAuthText} from '../auth-templates/templates.mjs';
import {APP_SAMPLE, GO_SAMPLE, ORIGIN, WEEKLY_SAMPLE, renderGoLite} from '../../../scripts/correos/muestras.mjs';
import {escribir, muestras} from '../../../scripts/correos/previsualizar.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const snapDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'snapshots');
const ANTI = 'Rovaq nunca te pedirá tu contraseña por correo.';

// Todas las piezas, con su HTML renderizado con datos de ejemplo. Las de Auth traen además el HTML crudo (con variables Go).
const labelFor = e => (e.labelAllowed ? 'Hubspot' : '');
const pieces = [
  ...authCatalog.map(item => ({id: 'auth-' + item.id, auth: true, item, subject: item.subject, preheader: item.preheader, raw: renderAuth(item), rawText: renderAuthText(item), html: renderGoLite(renderAuth(item)), text: renderGoLite(renderAuthText(item))})),
  ...appCatalog.map(e => ({id: 'app-' + e.type, entry: e, ...renderEmail({type: e.type, ...APP_SAMPLE, resourceLabel: labelFor(e)})})),
  {id: 'app-reporte-semanal', weekly: true, ...renderWeeklyReport(WEEKLY_SAMPLE)},
];
const hosts = ref => { try { return new URL(ref).hostname; } catch { return null; } };

test('hay trece plantillas de Auth, siete avisos de la app y el reporte semanal', () => {
  assert.equal(authCatalog.length, 13);
  assert.equal(authCatalog.filter(i => i.notice).length, 7);
  assert.equal(appCatalog.length, 7);
  assert.equal(pieces.length, 21);
});

test('toda plantilla tiene versión de texto plano; las de Auth son solo HTML en Supabase y se documenta', () => {
  for (const p of pieces) {
    assert.ok(typeof p.text === 'string' && p.text.length > 120, `${p.id}: texto vacío`);
    assert.doesNotMatch(p.text, /<[a-z][\s\S]*>/i, `${p.id}: el texto no debe llevar HTML`);
    assert.match(p.text, /--\nRovaq nunca te pedirá tu contraseña por correo\./, `${p.id}: pie en texto`);
  }
  for (const item of authCatalog) assert.ok(fs.existsSync(path.join(root, 'supabase/templates/auth/texto', item.id + '.txt')), `${item.id}: falta el .txt hermano`);
  assert.match(read('apps/web/docs/CORREOS.md'), /Supabase Auth solo envía HTML/);
});

test('el texto plano usa líneas de 72 columnas o menos', () => {
  for (const p of pieces) for (const line of (p.rawText ?? p.text).split('\n')) {
    if (line.length > 72) assert.ok(/^\S+$/.test(line.trim()) || line.includes('{{'), `${p.id}: línea larga «${line}»`);
  }
});

test('enlaces e imágenes solo a dominios permitidos y por HTTPS', () => {
  for (const p of pieces) {
    const refs = [...(p.raw ?? p.html).matchAll(/\b(?:href|src)="([^"]*)"/g)].map(m => m[1]);
    assert.ok(refs.length >= 3, p.id);
    for (const ref of refs) {
      if (/^\{\{[^}]*\}\}/.test(ref) || ref.startsWith('#')) continue; // variable Go de Supabase (SiteURL, ConfirmationURL)
      if (ref.startsWith('mailto:')) { assert.ok(ALLOWED_HOSTS.includes(ref.split('@')[1]), `${p.id}: ${ref}`); continue; }
      assert.match(ref, /^https:\/\//, `${p.id}: ${ref} no es https`);
      assert.ok(ALLOWED_HOSTS.includes(hosts(ref)), `${p.id}: dominio no permitido ${ref}`);
    }
    assert.doesNotMatch(p.raw ?? p.html, /javascript:|data:text|bit\.ly|tinyurl|t\.co\//i, p.id);
    for (const url of (p.rawText ?? p.text).match(/https?:\/\/[^\s)]+/g) ?? []) { assert.match(url, /^https:/); assert.ok(ALLOWED_HOSTS.includes(hosts(url)), `${p.id} texto: ${url}`); }
    for (const url of p.html.replace(/xmlns(?::\w+)?="[^"]*"/g, '').match(/https?:\/\/[^\s"'<>)]+/g) ?? []) assert.ok(ALLOWED_HOSTS.includes(hosts(url)), `${p.id} html renderizado: ${url}`);
  }
  assert.doesNotMatch(read('supabase/templates/auth/magic_link.html').replace(/xmlns(?::\w+)?="[^"]*"/g, ''), /https?:\/\/(?!rovaq-ai\.vercel\.app)/);
});

test('el logo claro y oscuro son PNG públicos que existen en apps/web/public/email', () => {
  for (const f of ['light', 'dark']) {
    const p = path.join(root, 'apps/web/public', IDENTITY.logo[f]);
    assert.ok(fs.statSync(p).size > 1000, p);
    assert.equal(fs.readFileSync(p).subarray(1, 4).toString(), 'PNG');
  }
});

test('sin PII ni datos de clientes: plantillas estáticas, entradas rechazadas y asuntos limpios', () => {
  const allowedMails = new Set([IDENTITY.supportEmail, IDENTITY.securityEmail]);
  for (const p of pieces) {
    const staticText = p.auth ? p.raw + p.rawText : p.html + p.text;
    for (const m of staticText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []) assert.ok(allowedMails.has(m.replace(/\.+$/, '')), `${p.id}: correo ${m}`);
    assert.doesNotMatch(staticText, /(?:\+?\d[\s().-]?){9,}/, `${p.id}: parece un teléfono`);
    if (!p.weekly) assert.doesNotMatch(p.html + p.text, /\$\s?\d/, `${p.id}: importe en una notificación`);
    assert.doesNotMatch(p.subject, p.weekly ? /@|\d{5,}/ : /@|\$|\d{4,}/, `${p.id}: dato en el asunto`); // el asunto del reporte lleva una cifra agregada por diseño
  }
  const base = {appOrigin: ORIGIN, ctaUrl: ORIGIN + '/x'};
  for (const bad of ['maria@cliente.com', 'Cliente 5512345678', '<b>x</b>', 'https://evil.test', 'Pedido $9,999', '*negrita*', '[a](https://evil.test)', 'x'.repeat(41)]) {
    assert.throws(() => renderEmail({type: 'connection.attention', ...base, resourceLabel: bad}), /invalid_label/, bad);
    assert.throws(() => safeResourceLabel(bad));
  }
  for (const bad of ['maria@cliente.com', 'Tel 55 1234 5678', '[x](https://evil.test)', '**x**', '{{ .Email }}']) assert.throws(() => renderEmail({type: 'membership.welcome', ...base, espacio: bad}), /invalid_space/, bad);
  for (const type of ['digest.available', 'membership.welcome', 'membership.invited', 'brief.available', 'intervention.assigned']) assert.throws(() => renderEmail({type, ...base, resourceLabel: 'Hubspot'}), /label_not_allowed/, type);
  const risky = renderEmail({type: 'processing.failed', ...base, resourceLabel: 'Libro de pedidos'});
  assert.ok(!risky.subject.includes('Libro') && !risky.preheader.includes('Libro'));
  assert.match(risky.html, /Libro de pedidos/);
  assert.equal(safeResourceLabel('Libro de pedidos (2026)'), 'Libro de pedidos (2026)');
  assert.throws(() => renderWeeklyReport({...WEEKLY_SAMPLE, dolores: [{label: 'Cliente maria@x.com', monto: 10}]}), /invalid_pain/);
  assert.throws(() => renderWeeklyReport({...WEEKLY_SAMPLE, fraseClave: 'Llamar al 55 1234 5678'}), /invalid_key_phrase/);
});

test('asunto de 55 caracteres o menos, sin sufijo «· Rovaq AI», sin signos de exclamación', () => {
  const longName = 'Nombre larguísimo de una empresa con muchas palabras SA';
  const subjects = [
    ...authCatalog.map(i => i.subject),
    ...appCatalog.map(e => renderEmail({type: e.type, ...APP_SAMPLE, resourceLabel: labelFor(e)}).subject),
    renderEmail({type: 'membership.invited', ...APP_SAMPLE, espacio: safeText(longName.slice(0, 40), 40)}).subject,
    renderWeeklyReport(WEEKLY_SAMPLE).subject,
    renderWeeklyReport({...WEEKLY_SAMPLE, rangoCorto: '28 oct–3 nov', titularCorto: 'reembolsos $1,234.5 M y mucho texto adicional'}).subject,
    renderWeeklyReport({...WEEKLY_SAMPLE, sinCambios: true}).subject,
  ];
  for (const s of subjects) { assert.ok(s.length <= 55, `${s} (${s.length})`); assert.doesNotMatch(s, /· Rovaq AI|!|¡|^\[Rovaq\]|^Re:|URGENTE/i, s); }
  assert.equal(renderEmail({type: 'membership.invited', ...APP_SAMPLE, espacio: longName.slice(0, 40)}).subject.length <= 55, true);
  const config = read('supabase/config.toml');
  for (const item of authCatalog) assert.ok(config.includes(`subject = ${JSON.stringify(item.subject)}`), item.id);
  assert.doesNotMatch(config, /· Rovaq AI/);
});

test('cabeceras de baja solo en notificaciones y reportes, nunca en acceso, invitación ni seguridad', () => {
  for (const e of appCatalog) {
    const r = renderEmail({type: e.type, ...APP_SAMPLE, resourceLabel: labelFor(e)});
    assert.equal(r.headers['Content-Language'], 'es-MX');
    if (e.kind === 'notification') {
      assert.equal(r.headers['List-Unsubscribe'], `<${APP_SAMPLE.unsubscribeUrl}>`, e.type);
      assert.equal(r.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click', e.type);
      assert.equal(renderEmail({type: e.type, ...APP_SAMPLE, unsubscribeUrl: undefined, resourceLabel: labelFor(e)}).headers['List-Unsubscribe'], undefined, 'sin URL no se anuncia baja');
    } else { assert.equal(e.type, 'membership.invited'); assert.equal(r.headers['List-Unsubscribe'], undefined); assert.equal(r.headers['List-Unsubscribe-Post'], undefined); }
  }
  const w = renderWeeklyReport(WEEKLY_SAMPLE);
  assert.equal(w.headers['List-Unsubscribe'], `<${WEEKLY_SAMPLE.urls.baja}>`);
  assert.equal(w.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.equal(w.headers.Precedence, 'bulk');
  assert.throws(() => renderWeeklyReport({...WEEKLY_SAMPLE, urls: {...WEEKLY_SAMPLE.urls, baja: undefined}}));
  assert.throws(() => unsubscribeHeaders('http://rovaq-ai.vercel.app/baja', ORIGIN));
  assert.throws(() => unsubscribeHeaders('https://evil.test/baja', ORIGIN));
  assert.throws(() => unsubscribeHeaders(ORIGIN + '/baja\r\nBcc: x@y.z', ORIGIN));
  for (const item of authCatalog) assert.equal(item.headers, undefined, 'los correos de Auth no declaran cabeceras de baja');
});

test('modo oscuro, preheader, VML, accesibilidad y pie legal presentes en todas las plantillas', () => {
  for (const p of pieces) {
    const h = p.raw ?? p.html;
    assert.match(h, /<html lang="es-MX" dir="ltr"/, p.id);
    assert.match(h, /<meta name="color-scheme" content="light dark">/, p.id);
    assert.match(h, /<meta name="supported-color-schemes" content="light dark">/, p.id);
    assert.match(h, /@media \(prefers-color-scheme:dark\)/, p.id);
    for (const c of [TOKENS.dark.canvas, TOKENS.dark.card, TOKENS.dark.ink, TOKENS.dark.btnBg]) assert.ok(h.includes(c), `${p.id}: falta ${c} en oscuro`);
    assert.match(h, /class="logo-l"[^>]*alt="Rovaq"/, p.id);
    assert.match(h, /class="logo-d"[^>]*alt=""/, p.id);
    assert.match(h, /negativo-600px\.png/); assert.match(h, /positivo-600px\.png/);
    const pre = /<div style="display:none;[^"]*">([^<]*?)(?:&nbsp;&zwnj;)+<\/div>/.exec(h);
    assert.ok(pre, `${p.id}: sin preheader`);
    assert.ok(pre[1].length >= 40 && pre[1].length <= 90 || p.auth, `${p.id}: preheader de ${pre[1].length} caracteres`);
    assert.ok((p.preheader).length >= 38 && p.preheader.length <= 90, `${p.id}: preheader ${p.preheader.length}`);
    assert.ok(!p.subject.toLowerCase().includes(p.preheader.toLowerCase()) && !p.preheader.toLowerCase().includes(p.subject.toLowerCase()), `${p.id}: el preheader repite el asunto`);
    assert.equal((h.match(/<h1 /g) ?? []).length, 1, p.id);
    for (const tag of h.match(/<table\b[^>]*>/g)) assert.match(tag, /role="presentation"/, p.id);
    assert.match(h, /<table role="presentation" class="w" width="600"/, p.id);
    const buttons = (h.match(/class="btn-a"/g) ?? []).length;
    assert.equal((h.match(/<v:roundrect/g) ?? []).length, buttons, `${p.id}: cada botón lleva VML`);
    for (const img of h.match(/<img\b[^>]*>/g)) assert.match(img, /\balt="/, p.id);
    assert.match(h, new RegExp(ANTI.replace(/\./g, '\\.')), p.id);
    assert.match(h, /Recib(?:es|imos)|Te enviamos|Te avisamos/, `${p.id}: falta motivo del envío`);
    assert.match(h, /Ciudad de México, México/, p.id);
    assert.ok(Buffer.byteLength(h) < 100_000, `${p.id}: pesa ${Buffer.byteLength(h)}`);
    const visible = h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!doctype html>/i, '').replace(/<[^>]*>/g, ' ');
    assert.doesNotMatch(visible + p.text, /!|¡|\p{Extended_Pictographic}/u, `${p.id}: exclamación o emoji`);
    assert.doesNotMatch(h, /<script|<form|<iframe|<video|background-image|@font-face|<link\b/i, p.id);
    assert.doesNotMatch(h, /#166534/i, `${p.id}: el botón verde del diseño anterior`);
  }
});

test('el botón es negro (blanco en oscuro) y el rojo solo marca el punto y la barra', () => {
  const h = renderAuth(authCatalog.find(i => i.id === 'magic_link'));
  assert.match(h, /bgcolor="#0E0E10"/);
  assert.match(h, /\.btn-a\{background:#F4F4F5!important;color:#0E0E10!important/);
  assert.equal((h.match(/#E8241C/gi) ?? []).length, 0);
});

test('contraste AA (4.5:1) en todos los pares de color declarados', () => {
  assert.ok(CONTRAST_PAIRS.length >= 20);
  for (const [name, fg, bg] of CONTRAST_PAIRS) assert.ok(contrastRatio(fg, bg) >= 4.5, `${name}: ${fg} sobre ${bg} = ${contrastRatio(fg, bg).toFixed(2)}`);
  assert.ok(contrastRatio('#FFFFFF', '#0E0E10') > 18);
  // Los colores de datos no son texto: solo se usan como fondo de barras y marcas de 3 px.
  const weekly = pieces.find(p => p.weekly).html;
  for (const color of Object.values(TOKENS.kpi)) for (const m of weekly.matchAll(new RegExp(`[^-]color:${color}`, 'gi'))) assert.fail(`color de datos usado como texto: ${m[0]}`);
});

test('Supabase: cada variable y acción Go existe y corresponde a la plantilla', () => {
  const documented = new Set(['.ConfirmationURL', '.Token', '.TokenHash', '.SiteURL', '.Email', '.NewEmail', '.OldEmail', '.Provider', '.FactorType', '.RedirectTo', '.Data.invita', '.Data.espacio', '.Data.rol', '.Data.rol_funcion', '.Data.rol_descripcion', '.Data.vence']);
  const required = {magic_link: ['.ConfirmationURL', '.Email'], confirmation: ['.ConfirmationURL', '.Email'], recovery: ['.ConfirmationURL', '.Email'], invite: ['.ConfirmationURL'], email_change: ['.ConfirmationURL', '.Email', '.NewEmail'], reauthentication: ['.Token'], password_changed_notification: ['.Email'], phone_changed_notification: ['.Email'], identity_linked_notification: ['.Provider'], identity_unlinked_notification: ['.Provider'], mfa_factor_enrolled_notification: ['.FactorType'], mfa_factor_unenrolled_notification: ['.FactorType']};
  for (const item of authCatalog) {
    for (const [name, content] of [['html', renderAuth(item)], ['txt', renderAuthText(item)]]) {
      const used = new Set();
      let depth = 0;
      for (const m of content.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
        const expr = m[1].trim();
        const action = expr.split(/\s+/)[0];
        if (action === 'end') { depth--; continue; }
        if (action === 'if') depth++;
        if (action === 'if' || action === 'or') assert.ok(GO_ACTIONS.includes(action));
        else assert.match(expr, /^\.[\w.]+$/, `${item.id}: expresión no permitida «${expr}»`);
        for (const v of expr.match(/\.[A-Za-z][\w.]*/g) ?? []) { assert.ok(documented.has(v), `${item.id}.${name}: variable desconocida ${v}`); assert.ok(item.vars.includes(v), `${item.id}.${name}: ${v} no está declarada para esta plantilla`); used.add(v); }
        assert.doesNotMatch(expr, /\.RedirectTo|\.Data\.(?!invita|espacio|rol|rol_funcion|rol_descripcion|vence)/);
      }
      assert.equal(depth, 0, `${item.id}.${name}: {{ if }} sin cerrar`);
      for (const v of required[item.id] ?? []) assert.ok(used.has(v), `${item.id}.${name}: falta ${v}`);
    }
    if (item.id !== 'invite') assert.ok(!renderAuth(item).includes('.Data'), `${item.id}: user_metadata solo se lee en la invitación`);
  }
  assert.equal((renderAuth(authCatalog.find(i => i.id === 'reauthentication')).match(/\.ConfirmationURL/g) ?? []).length, 0);
  assert.equal((renderAuth(authCatalog.find(i => i.id === 'magic_link')).match(/\{\{ \.ConfirmationURL \}\}/g) ?? []).length, 4); // VML, botón, y dirección visible (enlace y texto)
  // Con y sin metadatos de invitación el intérprete produce HTML sin llaves sobrantes.
  const invite = renderAuth(authCatalog.find(i => i.id === 'invite'));
  for (const data of [GO_SAMPLE, {...GO_SAMPLE, '.Data.invita': '', '.Data.espacio': '', '.Data.rol': '', '.Data.vence': ''}]) assert.doesNotMatch(renderGoLite(invite, data), /\{\{|no value/);
  assert.match(renderGoLite(invite, {...GO_SAMPLE, '.Data.invita': '', '.Data.espacio': '', '.Data.rol': ''}), /Una persona te invitó a un espacio/);
});

test('la vigencia dicha en los textos coincide con otp_expiry de config.toml; el correo con código no contradice la regla de seguridad', () => {
  assert.equal(OTP_EXPIRY_SECONDS, 3600);
  assert.match(read('supabase/config.toml'), new RegExp(`otp_expiry = ${OTP_EXPIRY_SECONDS}\\b`));
  assert.equal(VIGENCIA.enlace, '1 hora');
  for (const id of ['magic_link', 'confirmation', 'recovery', 'email_change']) assert.match(renderAuthText(authCatalog.find(i => i.id === id)), /1 hora/);
  const reauth = renderAuthText(authCatalog.find(i => i.id === 'reauthentication'));
  assert.match(reauth, /\{\{ \.Token \}\}/);
  assert.match(reauth.replace(/\s+/g, ' '), /No compartas este código con nadie, ni siquiera con Rovaq\./);
  for (const p of pieces) assert.doesNotMatch(p.raw ?? p.html, /nunca te pediremos|contraseñas ni códigos por correo/i, `${p.id}: la frase que contradice la reautenticación`);
});

test('config.toml, archivos generados y parche de Management API coinciden con el generador', () => {
  const config = read('supabase/config.toml');
  assert.ok(config.includes(localConfig()));
  for (const item of authCatalog) {
    assert.equal(read(`supabase/templates/auth/${item.id}.html`), renderAuth(item), `${item.id}: ejecutar node packages/notifications/auth-templates/templates.mjs --write`);
    assert.equal(read(`supabase/templates/auth/texto/${item.id}.txt`), renderAuthText(item), item.id);
    assert.equal(managementPatch()['mailer_templates_' + item.id + '_content'], renderAuth(item));
  }
  const keys = Object.keys(managementPatch());
  assert.equal(keys.length, 33);
  for (const k of keys) assert.match(k, /^mailer_(subjects_\w+|templates_\w+_content|notifications_\w+_enabled)$/);
});

test('reporte semanal: estructura, datos faltantes sin 0, semana sin cambios y entradas inválidas', () => {
  const w = renderWeeklyReport(WEEKLY_SAMPLE);
  assert.equal(w.subject, 'Reporte semanal · 14–20 oct: reembolsos $123.4k');
  assert.match(w.preheader, /^Reembolsos \$123\.4k, 10 SKUs explican el 59 %\. Una acción por decidir\.$/);
  const order = ['Reporte semanal · 14 al 20 de octubre de 2026', 'Se devolvieron $123.4k; 10 SKUs explican el 59', 'Ingreso bruto', 'Reembolsos', 'Dinero atorado', 'Sin respuesta', 'Principales puntos de dolor', 'Acción recomendada', 'Abrir el informe completo', 'Fuentes:'];
  let at = -1;
  for (const s of order) { const i = w.html.replace(/ /g, ' ').indexOf(s, at + 1); assert.ok(i > at, `orden de «${s}»`); at = i; }
  for (const c of Object.values(TOKENS.kpi)) assert.ok(w.html.includes(c));
  assert.match(w.html, /\+4\.2 %/);
  assert.match(w.text, /CIFRAS DE LA SEMANA/);
  assert.doesNotMatch(w.text, / /);
  assert.match(w.text, /Ingreso bruto\s+\$3\.84 M\s+\+4\.2 %/);
  const sin = renderWeeklyReport({...WEEKLY_SAMPLE, atorado: {valor: null, delta: null, fuente: 'el libro de pedidos'}});
  assert.match(sin.text, /Dinero atorado\s+—\s+\(sin dato de el libro de pedidos\)/);
  assert.doesNotMatch(sin.text, /Dinero atorado\s+\$?0\b/);
  const quiet = renderWeeklyReport({...WEEKLY_SAMPLE, sinCambios: true});
  assert.match(quiet.html, /Semana sin cambios relevantes/);
  assert.match(quiet.subject, /sin cambios/);
  assert.ok(renderWeeklyReport({...WEEKLY_SAMPLE, dolores: [], accion: undefined}).html.includes('Abrir el informe completo'));
  assert.throws(() => renderWeeklyReport({...WEEKLY_SAMPLE, rol: 'Dueño'}), /invalid_role/);
  assert.throws(() => renderWeeklyReport({...WEEKLY_SAMPLE, ingreso: {valor: Number.NaN, delta: 1}}), /invalid_income/);
  assert.throws(() => renderWeeklyReport({...WEEKLY_SAMPLE, urls: {...WEEKLY_SAMPLE.urls, informe: 'https://evil.test/x'}}), /invalid_url/);
  assert.throws(() => renderWeeklyReport({...WEEKLY_SAMPLE, appOrigin: 'http://rovaq-ai.vercel.app'}));
  assert.doesNotMatch(w.text + w.html, /\bmargen\b(?! *\.| *,)|ahorro/i);
});

test('formato es-MX de cifras', () => {
  assert.deepEqual([123_400, 3_840_000, 212_000, 950, 1_234_500_000].map(fmtMonto), ['$123.4k', '$3.84 M', '$212k', '$950', '$1,234.50 M']);
});

test('el motor es escapado: texto de la app con marcado no se interpreta', () => {
  const r = renderLayout({go: false, subject: 's', preheader: 'p'.repeat(45), eyebrow: 'e', h1: '<img src=x onerror=alert(1)>', blocks: [{type: 'p', text: '<script>1</script> & "q"'}, {type: 'button', label: 'Ir', href: 'https://rovaq-ai.vercel.app/a"onclick="x'}], footer: {strong: ANTI, motive: 'm'}});
  assert.doesNotMatch(r.html, /<script|<img src=x|onclick="x/);
  assert.match(r.html, /&lt;script&gt;1&lt;\/script&gt; &amp; &quot;q&quot;/);
});

test('el previsualizador escribe todas las plantillas con logo local', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rovaq-correos-test-'));
  try {
    const {count} = escribir(dir);
    assert.equal(count, muestras().length);
    assert.equal(count, 23);
    const files = fs.readdirSync(dir);
    assert.ok(files.includes('index.html') && files.includes('img'));
    assert.equal(files.filter(f => f.endsWith('.html')).length, count + 1);
    for (const f of files.filter(f => f.endsWith('.html') && f !== 'index.html')) assert.match(fs.readFileSync(path.join(dir, f), 'utf8'), /src="img\/rovaq-logo-horizontal-positivo-600px\.png"/, f);
    for (const f of files.filter(f => f.endsWith('.html'))) assert.doesNotMatch(fs.readFileSync(path.join(dir, f), 'utf8'), /\{\{/, f);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

// ---- Snapshots: las cinco maquetas del documento y una huella de todas las demás ----
const SNAP = {
  '01-acceso': p => p.html, // magic_link
};
const maquetas = {
  '01-acceso': pieces.find(p => p.id === 'auth-magic_link').html,
  '02-invitacion': pieces.find(p => p.id === 'app-membership.invited').html,
  '03-aviso-seguridad': pieces.find(p => p.id === 'auth-email_changed_notification').html,
  '04-alerta-datos': pieces.find(p => p.id === 'app-connection.attention').html,
  '05-reporte-semanal': pieces.find(p => p.id === 'app-reporte-semanal').html,
};
void SNAP;
const update = process.env.UPDATE_SNAPSHOTS === '1';
for (const [name, html] of Object.entries(maquetas)) {
  test(`snapshot de la maqueta ${name}`, () => {
    const file = path.join(snapDir, name + '.html');
    if (update) fs.writeFileSync(file, html);
    assert.equal(html, fs.readFileSync(file, 'utf8'), `cambió ${name}; revisar y regenerar con UPDATE_SNAPSHOTS=1`);
  });
}
test('huella de todas las plantillas (cualquier cambio visual debe ser deliberado)', () => {
  const sums = Object.fromEntries(pieces.flatMap(p => [[p.id + '.html', p.html], [p.id + '.txt', p.text]]).map(([k, v]) => [k, crypto.createHash('sha256').update(v).digest('hex').slice(0, 16)]));
  const file = path.join(snapDir, 'huellas.json');
  if (update) fs.writeFileSync(file, JSON.stringify(sums, null, 1) + '\n');
  assert.deepEqual(sums, JSON.parse(fs.readFileSync(file, 'utf8')));
});

// ---- Transporte: el correo sale multipart (html + text) y con las cabeceras del render ----
test('el transporte de correo envía html, texto y cabeceras; la baja solo si hay URL configurada', async () => {
  const {createEmailTransport, renderWeeklyReport: reexported} = await import('../email.mjs');
  assert.equal(reexported, renderWeeklyReport);
  const send = async unsubscribeUrl => {
    const calls = [];
    const repository = {resolveRecipient: async () => null, prepare: async () => ({email: 'persona@empresa-ejemplo.mx', emailVerified: true}), accepted: async () => {}};
    const transport = createEmailTransport({mode: 'resend', apiKey: 're_test_key', from: 'avisos@rovaq.ai', appOrigin: ORIGIN, unsubscribeUrl, repository, resend: {emails: {send: async (message, options) => { calls.push({message, options}); return {data: {id: 'msg_1'}}; }}}});
    assert.equal(transport.configured(), true);
    const result = await transport.send({recipient: {email: 'persona@empresa-ejemplo.mx', emailVerified: true, channel: 'email', tenantId: 't', userId: 'u'}, idempotencyKey: 'a'.repeat(64)});
    assert.deepEqual(result, {kind: 'accepted', providerId: 'msg_1'});
    return calls[0].message;
  };
  const withBaja = await send(ORIGIN + '/api/notifications/unsubscribe');
  assert.ok(withBaja.html.length > 2000 && withBaja.text.length > 200);
  assert.equal(withBaja.subject, 'Tienes avisos nuevos en Rovaq');
  assert.equal(withBaja.headers['List-Unsubscribe'], `<${ORIGIN}/api/notifications/unsubscribe>`);
  assert.equal(withBaja.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  const without = await send(undefined);
  assert.equal(without.headers['List-Unsubscribe'], undefined);
  assert.equal(without.headers['Content-Language'], 'es-MX');
  const bad = createEmailTransport({mode: 'resend', apiKey: 're_test_key', from: 'avisos@rovaq.ai', appOrigin: ORIGIN, unsubscribeUrl: 'http://evil.test/baja', repository: {}, resend: {}});
  assert.equal(bad.configured(), false, 'una URL de baja inválida bloquea el canal');
});
