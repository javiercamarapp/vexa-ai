// Sistema de diseño de correo de Rovaq (CORREOS-DISENO.md, 24-oct-2026).
// Módulo puro, sin dependencias: lo usan las plantillas de Supabase Auth
// (support/F08-auth-brand, con variables Go `{{ .X }}`) y las notificaciones de la app
// (email-template.mjs, email-weekly.mjs, con valores reales ya escapados aquí).
// Una sola fuente por plantilla: bloques -> HTML y texto plano, en el mismo orden.
// Idioma: todas las funciones de salida aceptan `idioma` ('es' | 'en'); sin él el resultado es el español de siempre, byte a byte.
import { idiomaDe, langDe, porIdioma } from './idioma.mjs';

/** Identidad de envío. Dominio y buzones son marcadores hasta que Javier los confirme. */
export const IDENTITY = Object.freeze({
  brandName: 'Rovaq',
  legalName: 'Rovaq AI',
  /** Origen público donde viven los PNG del logo (apps/web/public/email). */
  assetOrigin: 'https://rovaq-ai.vercel.app',
  supportEmail: 'soporte@rovaq.ai',
  securityEmail: 'seguridad@rovaq.ai',
  /** null = se omite el enlace hasta que exista la página (pendiente de Javier/legal). */
  privacyUrl: null,
  /** null = los avisos de seguridad no llevan botón de revocar (no existe el endpoint). */
  revokeUrl: null,
  city: 'Ciudad de México, México',
  logo: Object.freeze({
    light: '/email/rovaq-logo-horizontal-positivo-600px.png',
    dark: '/email/rovaq-logo-horizontal-negativo-600px.png',
    width: 112,
    height: 31,
  }),
});

/** Dominios a los que puede apuntar cualquier enlace o imagen de un correo. */
export const ALLOWED_HOSTS = Object.freeze(['rovaq-ai.vercel.app', 'vexa-ai.vercel.app', 'rovaq.ai']);

/** Vigencia declarada en los textos; debe coincidir con `[auth.email] otp_expiry` de config.toml. */
export const OTP_EXPIRY_SECONDS = 3600;
export const VIGENCIA = Object.freeze({ enlace: '1 hora', codigo: '1 hora' });

/** Tokens de color (panel de Rovaq). El color de datos vive en barras, nunca en texto. */
export const TOKENS = Object.freeze({
  light: Object.freeze({
    canvas: '#F6F6F7', card: '#FFFFFF', soft: '#F6F6F7', border: '#E6E6E8',
    ink: '#0E0E10', ink2: '#3A3A40', muted: '#5A5A61',
    btnBg: '#0E0E10', btnText: '#FFFFFF', red: '#E8241C',
    chipOk: Object.freeze({ bg: '#E7F5EE', fg: '#14604A' }),
    chipBad: Object.freeze({ bg: '#FFF3F5', fg: '#AC2440' }),
    chipWarn: Object.freeze({ bg: '#FFF7E5', fg: '#86580D' }),
  }),
  dark: Object.freeze({
    canvas: '#0E0E10', card: '#17171A', soft: '#1F1F23', border: '#26262B',
    ink: '#F4F4F5', ink2: '#D4D4D8', muted: '#A3A3AB',
    btnBg: '#F4F4F5', btnText: '#0E0E10', red: '#E8241C',
    chipOk: Object.freeze({ bg: '#10251B', fg: '#5FD3A0' }),
    chipBad: Object.freeze({ bg: '#342127', fg: '#FFB3C3' }),
    chipWarn: Object.freeze({ bg: '#342C20', fg: '#FFDC9A' }),
  }),
  /** Colores fijos por métrica del reporte (marcas de 3 px, nunca texto). */
  kpi: Object.freeze({ ingreso: '#2F6BD8', reembolsos: '#F25D22', atorado: '#D9A441', respuesta: '#1B6A7A', dolor: '#7B5CD6', accion: '#8C1D3A' }),
});

/** Pares texto/fondo que el sistema declara y que deben cumplir AA (4.5:1). */
export const CONTRAST_PAIRS = Object.freeze((() => {
  const pairs = [];
  for (const mode of ['light', 'dark']) {
    const t = TOKENS[mode];
    pairs.push(
      [`${mode} ink/card`, t.ink, t.card], [`${mode} ink2/card`, t.ink2, t.card], [`${mode} muted/card`, t.muted, t.card],
      [`${mode} muted/canvas (pie)`, t.muted, t.canvas], [`${mode} ink/canvas`, t.ink, t.canvas],
      [`${mode} ink/soft`, t.ink, t.soft], [`${mode} ink2/soft`, t.ink2, t.soft], [`${mode} muted/soft`, t.muted, t.soft],
      [`${mode} botón`, t.btnText, t.btnBg],
      [`${mode} chip ok`, t.chipOk.fg, t.chipOk.bg], [`${mode} chip malo`, t.chipBad.fg, t.chipBad.bg], [`${mode} chip atención`, t.chipWarn.fg, t.chipWarn.bg],
    );
  }
  return Object.freeze(pairs);
})());

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const FF = "'Hanken Grotesk',Arial,Helvetica,sans-serif";
const L = TOKENS.light;
const GO = /(\{\{[\s\S]*?\}\})/g;

/** Escapa HTML. Con `go`, deja intactas las variables y acciones de plantilla Go de Supabase. */
export function escapeHtml(value, go = false) {
  const base = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return go ? String(value).split(GO).map((part, i) => (i % 2 ? part : base(part))).join('') : base(String(value));
}

const INLINE = /\*\*((?:\{\{[\s\S]*?\}\}|[^*])+?)\*\*|\[([^\]]+)\]\(((?:\{\{[\s\S]*?\}\}|[^)\s])+)\)/g;
const linkStyle = `color:${L.ink};text-decoration:underline;`;

/** `**negrita**` y `[texto](enlace)` -> HTML escapado. */
export function inline(source, go = false, linkClass = 't-ink') {
  const s = String(source);
  let out = '', last = 0, m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(s))) {
    out += escapeHtml(s.slice(last, m.index), go);
    if (m[1] !== undefined) out += `<strong class="t-ink" style="font-weight:600;color:${L.ink};">${escapeHtml(m[1], go)}</strong>`;
    else out += `<a href="${escapeHtml(m[3], go)}" class="${linkClass}" style="${linkClass === 't-muted' ? `color:${L.muted};text-decoration:underline;` : linkStyle}">${escapeHtml(m[2], go)}</a>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(s.slice(last), go);
}

/** Misma sintaxis a texto plano: enlaces como `texto (url)`; `mailto:` sin repetir. */
export function plain(source, idioma = 'es') {
  const en = idiomaDe(idioma) === 'en';
  return String(source).replace(INLINE, (_all, bold, label, href) => {
    if (bold !== undefined) return bold;
    const bare = href.replace(/^mailto:/, '');
    // En inglés el enlace va entre ángulos (sin paréntesis en el texto visible).
    return label === bare || label === href ? label : en ? `${label} <${bare}>` : `${label} (${bare})`;
  });
}

/** Ajusta a ancho fijo sin partir variables Go ni direcciones. */
export function wrap(text, width = 72, indent = '') {
  const words = String(text).match(/(?:\{\{[\s\S]*?\}\}|\S)+/g) ?? [];
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && (indent + line + ' ' + word).length > width) { lines.push(indent + line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(indent + line);
  return lines.join('\n');
}

const CSS = `:root{color-scheme:light dark;supported-color-schemes:light dark}
body,table,td,a,p{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0;mso-table-rspace:0}
img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
.logo-d{display:none;max-height:0;overflow:hidden;mso-hide:all}
@media (max-width:620px){.w{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}.kpi-c{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:0!important;border-bottom:1px solid ${L.border}!important}.btn-full{display:block!important}}
@media (prefers-color-scheme:dark){
 body,.bg-canvas{background:${TOKENS.dark.canvas}!important}
 .bg-card{background:${TOKENS.dark.card}!important}.bg-soft{background:${TOKENS.dark.soft}!important}
 .bd{border-color:${TOKENS.dark.border}!important}.bdt{border-top-color:${TOKENS.dark.border}!important}.bdr{border-right-color:${TOKENS.dark.border}!important}.bdb{border-bottom-color:${TOKENS.dark.border}!important}
 .t-ink,.t-ink a{color:${TOKENS.dark.ink}!important}.t-ink2{color:${TOKENS.dark.ink2}!important}.t-muted{color:${TOKENS.dark.muted}!important}
 .btn-td{background:${TOKENS.dark.btnBg}!important}.btn-a{background:${TOKENS.dark.btnBg}!important;color:${TOKENS.dark.btnText}!important;border-color:${TOKENS.dark.btnBg}!important}
 .logo-l{display:none!important;max-height:0!important;overflow:hidden!important}.logo-d{display:block!important;max-height:none!important;overflow:visible!important}
 .chip-ok{background:${TOKENS.dark.chipOk.bg}!important;color:${TOKENS.dark.chipOk.fg}!important}.chip-bad{background:${TOKENS.dark.chipBad.bg}!important;color:${TOKENS.dark.chipBad.fg}!important}.chip-warn{background:${TOKENS.dark.chipWarn.bg}!important;color:${TOKENS.dark.chipWarn.fg}!important}
 .callout{background:${TOKENS.dark.soft}!important}
 .trk{background:${TOKENS.dark.border}!important}.kpi-c{border-bottom-color:${TOKENS.dark.border}!important}
}
[data-ogsc] .t-ink{color:${TOKENS.dark.ink}!important}`;

const MSO_FONTS = '<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>td,th,div,p,a,h1,h2{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->';

const P_MUTED = (size, lh, extra = '') => `font-family:${FF};font-size:${size}px;line-height:${lh}px;color:${L.muted};${extra}`;

function buttonWidth(label) { return Math.max(172, Math.ceil((label.length * 9 + 48) / 4) * 4); }

function buttonHtml({ label, href }, go) {
  const h = escapeHtml(href, go), l = escapeHtml(label, go), w = buttonWidth(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;"><tr><td class="btn-td" bgcolor="${L.btnBg}" style="border-radius:10px;background:${L.btnBg};mso-padding-alt:0;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${h}" style="height:44px;v-text-anchor:middle;width:${w}px;" arcsize="23%" strokecolor="${L.btnBg}" fillcolor="${L.btnBg}"><w:anchorlock/><center style="color:${L.btnText};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">${l}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a class="btn-a" href="${h}" style="display:inline-block;min-width:${w - 48}px;padding:12px 24px;border:1px solid ${L.btnBg};border-radius:10px;background:${L.btnBg};color:${L.btnText};font-family:${FF};font-size:15px;line-height:20px;font-weight:600;text-align:center;text-decoration:none;">${l}</a><!--<![endif]--></td></tr></table>`;
}

function listHtml(rows, go) {
  const body = rows.map(({ label, value, when }) => {
    const tr = `<tr><td class="bdb t-muted" width="38%" valign="top" style="padding:10px 0;border-bottom:1px solid ${L.border};font-family:${FF};font-size:14px;line-height:20px;color:${L.muted};">${inline(label, go)}</td><td class="bdb t-ink" valign="top" style="padding:10px 0;border-bottom:1px solid ${L.border};font-family:${FF};font-size:14px;line-height:20px;font-weight:500;color:${L.ink};">${inline(value, go)}</td></tr>`;
    return when ? `{{ if ${when} }}${tr}{{ end }}` : tr;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${body}</table>`;
}

function calloutHtml({ title, body, bar = L.red }, go) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td width="3" style="width:3px;background:${bar};font-size:0;line-height:0;">&nbsp;</td><td class="callout bg-soft" style="background:${L.soft};padding:12px 16px;"><p class="t-ink" style="margin:0 0 4px;font-family:${FF};font-size:14px;line-height:20px;font-weight:600;color:${L.ink};">${inline(title, go)}</p><p class="t-ink2" style="margin:0;font-family:${FF};font-size:14px;line-height:21px;color:${L.ink2};">${inline(body, go)}</p></td></tr></table>`;
}

function statsHtml(items, go) {
  const n = items.length;
  const cells = items.map(([label, value], i) => {
    const radius = i === 0 ? 'border-radius:10px 0 0 10px;' : i === n - 1 ? 'border-radius:0 10px 10px 0;' : '';
    return `<td class="bd bg-soft" width="${Math.floor(100 / n)}%" valign="top" style="padding:12px 14px;border:1px solid ${L.border};${i ? 'border-left:0;' : ''}${radius}background:${L.soft};"><p class="t-muted" style="margin:0 0 4px;font-family:${FF};font-size:12px;line-height:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${L.muted};">${inline(label, go)}</p><p class="t-ink" style="margin:0;font-family:${FF};font-size:24px;line-height:28px;font-weight:700;color:${L.ink};">${inline(value, go)}</p></td>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>${cells}</tr></table>`;
}

function codeHtml(token, go) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;"><tr><td class="bg-soft" align="center" style="background:${L.soft};border-radius:10px;padding:16px;"><p class="t-ink" style="margin:0;font-family:'Courier New',Courier,monospace;font-size:28px;line-height:36px;font-weight:700;letter-spacing:.2em;color:${L.ink};">${escapeHtml(token, go)}</p></td></tr></table>`;
}

function kpisHtml(items, go) {
  const n = items.length;
  const cells = items.map((k, i) => {
    const chip = k.chip ? `<span class="chip-${k.tone ?? 'warn'}" style="display:inline-block;padding:2px 8px;border-radius:999px;font-family:${FF};font-size:12px;line-height:16px;font-weight:600;background:${L[`chip${{ ok: 'Ok', bad: 'Bad', warn: 'Warn' }[k.tone ?? 'warn']}`].bg};color:${L[`chip${{ ok: 'Ok', bad: 'Bad', warn: 'Warn' }[k.tone ?? 'warn']}`].fg};">${escapeHtml(k.chip, go)}</span>` : '';
    const note = k.note ? `<p class="t-muted" style="margin:6px 0 0;${P_MUTED(12, 16)}">${escapeHtml(k.note, go)}</p>` : '';
    return `<td class="kpi-c bdr" width="${Math.floor(100 / n)}%" valign="top" style="padding:14px;${i < n - 1 ? `border-right:1px solid ${L.border};` : ''}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="3" style="height:3px;line-height:3px;font-size:0;background:${k.color};border-radius:2px;">&nbsp;</td></tr></table><p class="t-muted" style="margin:10px 0 4px;font-family:${FF};font-size:12px;line-height:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${L.muted};">${escapeHtml(k.label, go)}</p><p class="t-ink" style="margin:0 0 6px;font-family:${FF};font-size:24px;line-height:28px;font-weight:700;color:${L.ink};">${escapeHtml(k.value, go)}</p>${chip}${note}</td>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bdt bdb" style="border-top:1px solid ${L.border};border-bottom:1px solid ${L.border};"><tr>${cells}</tr></table>`;
}

function rowsHtml(items, go) {
  const body = items.map((r, i) => `<tr><td class="bdb" style="padding:10px 0;border-bottom:1px solid ${L.border};font-family:${FF};font-size:14px;line-height:20px;color:${L.ink};"><span class="t-muted" style="color:${L.muted};">${i + 1}</span>&nbsp;&nbsp;<span class="t-ink" style="font-weight:500;">${escapeHtml(r.label, go)}</span></td><td class="bdb" width="120" style="padding:10px 0 10px 12px;border-bottom:1px solid ${L.border};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="trk" style="background:${L.border};height:6px;line-height:6px;font-size:0;border-radius:3px;"><table role="presentation" width="${Math.max(4, Math.min(100, Math.round(r.pct)))}%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${TOKENS.kpi.dolor};height:6px;line-height:6px;font-size:0;border-radius:3px;">&nbsp;</td></tr></table></td></tr></table></td><td class="bdb t-ink" align="right" width="64" style="padding:10px 0 10px 12px;border-bottom:1px solid ${L.border};font-family:${FF};font-size:14px;line-height:20px;font-weight:600;color:${L.ink};">${escapeHtml(r.value, go)}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${body}</table>`;
}

function urlLineHtml({ lead, url }, go) {
  const u = escapeHtml(url, go);
  return `<p class="t-muted" style="margin:0 0 12px;${P_MUTED(14, 21)}">${inline(lead, go)}<br><a href="${u}" class="t-ink" style="color:${L.ink};text-decoration:underline;word-break:break-all;">${u}</a></p>`;
}

/** HTML de un bloque. Tipos: p, help, list, button, code, callout, stats, kpis, rows, h2, urlLine. */
function blockHtml(b, go) {
  switch (b.type) {
    case 'p': return `<p class="t-ink2" style="margin:0 0 16px;font-family:${FF};font-size:15px;line-height:23px;font-weight:400;color:${L.ink2};">${inline(b.text, go)}</p>`;
    case 'help': return `<p class="t-muted" style="margin:0 0 12px;${P_MUTED(14, 21)}">${inline(b.text, go, 't-ink')}</p>`;
    case 'h2': return `<h2 class="t-ink" style="margin:4px 0 4px;font-family:${FF};font-size:16px;line-height:22px;font-weight:600;color:${L.ink};">${escapeHtml(b.text, go)}</h2>${b.sub ? `<p class="t-muted" style="margin:0 0 12px;${P_MUTED(14, 21)}">${escapeHtml(b.sub, go)}</p>` : ''}`;
    case 'list': return listHtml(b.rows, go);
    case 'button': return buttonHtml(b, go);
    case 'code': return codeHtml(b.text, go);
    case 'callout': return calloutHtml(b, go);
    case 'stats': return statsHtml(b.items, go);
    case 'kpis': return kpisHtml(b.items, go);
    case 'rows': return rowsHtml(b.items, go);
    case 'urlLine': return urlLineHtml(b, go);
    default: throw Error('unknown_block:' + b.type);
  }
}

/** Texto plano de un bloque, ancho <= 72 y el enlace en su propia línea. */
function blockText(b, idioma = 'es') {
  const en = idiomaDe(idioma) === 'en';
  const plain_ = x => plain(x, idioma);
  switch (b.type) {
    case 'p': case 'help': return wrap(plain_(b.text));
    case 'h2': return b.text.toUpperCase() + (b.sub ? '\n' + wrap(b.sub) : '');
    case 'list': {
      const rows = b.rows.map(r => [plain_(r.label), plain_(r.value), r.when]);
      const max = Math.max(...rows.map(r => r[0].length));
      return rows.map(([label, value, when]) => { const head = (label + ':').padEnd(max + 2); const line = head + wrap(value, 72 - head.length).split('\n').join('\n' + ' '.repeat(head.length)); return when ? `{{ if ${when} }}${line}{{ end }}` : line; }).join('\n');
    }
    case 'button': return `${b.label}:\n${b.href}`;
    case 'code': return `    ${b.text}`;
    case 'callout': return `${plain_(b.title).toUpperCase()}\n${wrap(plain_(b.body))}`;
    case 'stats': { const max = Math.max(...b.items.map(i => i[0].length)); return b.items.map(([l, v]) => `${(l + ':').padEnd(max + 2)}${plain_(v)}`).join('\n'); }
    case 'kpis': { const max = Math.max(...b.items.map(i => i.label.length)); return (en ? 'THIS WEEK\'S FIGURES\n' : 'CIFRAS DE LA SEMANA\n') + b.items.map(k => `${k.label.padEnd(max + 2)}${k.value}${k.chip ? `   ${k.chip}` : ''}${k.note ? (en ? `   ${k.note}` : `   (${k.note})`) : ''}`).join('\n'); }
    case 'rows': return b.items.map((r, i) => `${i + 1}. ${r.label}   ${r.value}`).join('\n');
    case 'urlLine': return `${wrap(plain_(b.lead))}\n${b.url}`;
    default: throw Error('unknown_block:' + b.type);
  }
}

const BLEED = new Set(['kpis']);

/**
 * Renderiza un correo completo.
 * @param {object} d
 *  - go: el contenido trae variables Go (Supabase); si no, los valores se escapan por completo
 *  - subject: asunto (también <title>)
 *  - preheader: 40-90 caracteres que complementan el asunto
 *  - eyebrow, alert: etiqueta superior; con alert lleva el punto rojo de «requiere acción»
 *  - h1, blocks: cuerpo principal; note: bloques bajo el filete
 *  - footer: { strong, extra?, motive }
 *  - assetOrigin: origen HTTPS de los PNG del logo
 * @returns {{html:string,text:string}}
 */
export function renderLayout(d) {
  const go = !!d.go;
  const idioma = idiomaDe(d.idioma), lang = langDe(idioma);
  const en = idioma === 'en';
  const origin = d.assetOrigin ?? IDENTITY.assetOrigin;
  const logoSrc = p => escapeHtml(origin.replace(/\/$/, '') + p, go);
  const pad = (top, inner, bottom = 12) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" style="padding:${top}px 36px ${bottom}px 36px;">${inner}</td></tr></table>`;
  const main = [];
  let acc = `<p class="t-muted" style="margin:0 0 8px;font-family:${FF};font-size:12px;line-height:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${L.muted};">${d.alert ? `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${L.red};vertical-align:middle;margin-right:6px;"></span>` : ''}${escapeHtml(d.eyebrow, go)}</p><h1 class="t-ink" style="margin:0 0 12px;font-family:${FF};font-size:24px;line-height:30px;font-weight:600;letter-spacing:-.02em;color:${L.ink};">${inline(d.h1, go)}</h1>`;
  let first = true;
  const flush = () => { if (acc) { main.push(pad(first ? 32 : 24, acc)); first = false; acc = ''; } };
  for (const b of d.blocks) {
    if (BLEED.has(b.type)) { flush(); main.push(blockHtml(b, go)); } else acc += blockHtml(b, go);
  }
  flush();
  const note = d.note?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="bdt" style="border-top:1px solid ${L.border};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>${pad(16, d.note.map(b => blockHtml(b, go)).join(''), 24)}` : '';
  const f = d.footer;
  const fp = (inner, last) => `<p class="t-muted" style="margin:0${last ? '' : ' 0 8px'};${P_MUTED(12, 18)}">${inner}</p>`;
  const contactBits = [`${escapeHtml(IDENTITY.legalName, go)}`, `<a href="mailto:${IDENTITY.supportEmail}" class="t-muted" style="color:${L.muted};text-decoration:underline;">${IDENTITY.supportEmail}</a>`];
  if (IDENTITY.privacyUrl) contactBits.push(`<a href="${escapeHtml(IDENTITY.privacyUrl, go)}" class="t-muted" style="color:${L.muted};text-decoration:underline;">${en ? 'Privacy notice' : 'Aviso de privacidad'}</a>`);
  contactBits.push(escapeHtml(en ? 'Mexico City, Mexico' : IDENTITY.city, go));
  const footerHtml = fp(`<strong style="font-weight:600;">${escapeHtml(f.strong, go)}</strong>${f.extra ? ' ' + escapeHtml(f.extra, go) : ''}`) + fp(inline(f.motive, go, 't-muted')) + fp(contactBits.join(' · '), true);

  const html = `<!doctype html>
<html lang="${lang}" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(d.subject, go)}</title>
${MSO_FONTS}
<style>
${CSS}</style>
</head>
<body class="bg-canvas" style="margin:0;padding:0;background:${L.canvas};word-spacing:normal;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${L.canvas};opacity:0;">${escapeHtml(d.preheader, go)}${'&nbsp;&zwnj;'.repeat(60)}</div>
<div role="article" aria-roledescription="email" lang="${lang}" dir="ltr">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-canvas" style="background:${L.canvas};"><tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;"><tr><td style="padding:0 4px 20px 4px;" align="left"><img class="logo-l" src="${logoSrc(IDENTITY.logo.light)}" width="${IDENTITY.logo.width}" height="${IDENTITY.logo.height}" alt="Rovaq" style="display:block;width:${IDENTITY.logo.width}px;height:auto;"><!--[if !mso]><!--><img class="logo-d" src="${logoSrc(IDENTITY.logo.dark)}" width="${IDENTITY.logo.width}" height="${IDENTITY.logo.height}" alt="" style="display:none;width:${IDENTITY.logo.width}px;height:auto;max-height:0;overflow:hidden;"><!--<![endif]--></td></tr><tr><td class="bg-card bd" style="background:${L.card};border:1px solid ${L.border};border-radius:12px;">${main.join('')}${note}</td></tr></table>
<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;"><tr><td class="px" style="padding:20px 4px 0 4px;">
${footerHtml}
</td></tr></table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></div></body></html>
`;

  const sections = [
    (d.alert ? (en ? 'ACTION REQUIRED · ' : 'REQUIERE ACCIÓN · ') : '') + d.eyebrow.toUpperCase(),
    wrap(plain(d.h1, idioma)),
    ...d.blocks.map(b => blockText(b, idioma)),
    ...(d.note ?? []).map(b => blockText(b, idioma)),
  ];
  const contactText = [IDENTITY.legalName, IDENTITY.supportEmail, en ? 'Mexico City, Mexico' : IDENTITY.city].join(' · ');
  const footerText = ['--', wrap(`${f.strong}${f.extra ? ' ' + f.extra : ''}`), wrap(plain(f.motive, idioma)), contactText, ...(IDENTITY.privacyUrl ? [`${en ? 'Privacy notice' : 'Aviso de privacidad'}: ${IDENTITY.privacyUrl}`] : [])].join('\n');
  const text = sections.join('\n\n') + '\n\n' + footerText + '\n';
  return { html, text };
}

// ---- Entradas de la app: todo valor libre pasa por aquí antes de llegar a una plantilla ----

/** Texto corto sin marcado ni datos personales evidentes (correo, URL, teléfono). */
export function safeText(value, max = 60, name = 'value') {
  if (typeof value !== 'string') throw Error('invalid_' + name);
  const v = value.replace(/\s+/g, ' ').trim();
  if (!v || v.length > max || /[\x00-\x1f\x7f*[\]`\\{}]/.test(v) || /@|:\/\/|www\./i.test(v) || /(?:\d[\s().-]?){7,}/.test(v)) throw Error('invalid_' + name);
  return v;
}
export const truncate = (v, max) => (v.length <= max ? v : v.slice(0, Math.max(0, max - 1)).trimEnd() + '…');

const nf = (n, d, idioma = 'es') => n.toLocaleString(langDe(idioma), { minimumFractionDigits: d, maximumFractionDigits: d });
/** `$854.7k`, `$3.84 M`, `$212k`, `$950` (en inglés `$3.84M`). */
export function fmtMonto(n, idioma = 'es') {
  if (!Number.isFinite(n)) throw Error('invalid_amount');
  const sign = n < 0 ? '-' : '', a = Math.abs(n), mm = porIdioma(idioma, ' M', 'M');
  if (a >= 1e6) return `${sign}$${nf(a / 1e6, 2, idioma)}${mm}`;
  if (a >= 1e3) return `${sign}$${nf(a / 1e3, 1, idioma).replace(/\.0$/, '')}k`;
  return `${sign}$${Math.round(a)}`;
}
/** `4.2 %` con espacio sin separación (en inglés `4.2%`). */
export const fmtPct = (n, d = 1, idioma = 'es') => `${nf(n, d, idioma).replace(/\.0+$/, '')}${porIdioma(idioma, '\u00A0%', '%')}`;
export const fmtDelta = (n, idioma = 'es') => `${n > 0 ? '+' : n < 0 ? '\u2212' : ''}${fmtPct(Math.abs(n), 1, idioma)}`;
/** `31 de octubre de 2026, 11:59 p. m. (hora CDMX)`; en inglés `October 31, 2026, 11:59 PM Mexico City time`. */
export function fmtFechaHora(iso, idioma = 'es') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw Error('invalid_date');
  if (idiomaDe(idioma) === 'en') {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    return f.replace(/[\s\u202f]+/g, ' ').replace(/ at /, ', ') + ' Mexico City time';
  }
  const f = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return f.replace(/\s+/g, ' ').replace(/([ap])\.\s?m\./i, (_m, x) => `${x.toLowerCase()}. m.`).replace(/ de (\d{4}),?(?: a las)? /, ' de $1, ') + ' (hora CDMX)';
}
