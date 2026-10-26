// Contraste WCAG AA de la paleta de marca en claro y oscuro: lee los tokens de los CSS (no hay valores copiados aquí) y mide las parejas clave.
// Texto normal >= 4,5:1; texto grande, UI y gráficas >= 3:1. Incluye las parejas que QA midió mal con el azul anterior.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const src = join(import.meta.dirname, '../src');
const FILES = ['app/globals.css', 'app/ui.css', 'components/refunds/fuga.css', 'components/platform/platform-ui.css'];
function tokens(dark) {
  const t = {};
  for (const f of FILES) {
    const css = readFileSync(join(src, f), 'utf8');
    for (const m of css.matchAll(/(:root(?:\[data-theme=dark\])?)\s*\{([^}]*)\}/g)) {
      if ((m[1] !== ':root') !== dark && !(m[1] === ':root' && dark)) continue;
      if (dark && m[1] === ':root') continue;
      for (const d of m[2].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)(?:;|$)/g)) t[d[1]] = d[2].trim();
    }
  }
  return t;
}
const LIGHT = tokens(false), DARK = {...LIGHT, ...tokens(true)}; // oscuro hereda lo no redefinido
const hex = (v) => { const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(v); assert.ok(m, 'color no hex: ' + v); return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); };
const lum = (rgb) => { const [r, g, b] = rgb.map(c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const val = (T, n) => { let v = T[n]; assert.ok(v, 'falta token --' + n); const ref = /^var\(--([a-z0-9-]+)\)$/.exec(v); if (ref) return val(T, ref[1]); return hex(v); };

// [token de primer plano, token de fondo, mínimo, motivo]
const PAREJAS = [
  ['ink', 'background', 4.5, 'texto'], ['ink', 'ui-surface', 4.5, 'texto'], ['ink', 'ui-soft', 4.5, 'texto'],
  ['muted', 'background', 4.5, 'texto secundario'], ['muted', 'ui-surface', 4.5, 'texto secundario'], ['muted', 'ui-soft', 4.5, 'texto secundario'],
  ['ui-secondary', 'ui-surface', 4.5, 'texto de botón secundario'], ['ui-secondary', 'ui-soft', 4.5, 'texto de botón secundario'],
  ['accent', 'background', 4.5, 'enlace'], ['accent', 'ui-surface', 4.5, 'enlace'], ['accent', 'ui-soft', 4.5, 'enlace en tarjeta (row-link-inline)'], ['accent', 'tint-info', 4.5, 'enlace sobre aviso informativo («Revisar fuentes y vínculos»)'],
  ['ui-action', 'ui-soft', 4.5, 'botón fantasma «Última publicación» 12 px'], ['ui-action', 'ui-surface', 4.5, 'botón fantasma / chips «Copiar» y «Publicación»'], ['ui-action', 'background', 4.5, 'acción'],
  ['ui-action-ink', 'ui-action', 4.5, 'botón primario'], ['ui-action-ink', 'ui-action-hover', 4.5, 'botón primario (hover)'],
  ['ui-nav-text', 'ui-nav-active', 4.5, 'ítem activo del menú'],
  ['ink-info', 'tint-info', 4.5, 'aviso informativo'], ['ink-up', 'tint-up', 4.5, 'delta bueno'], ['ink-down', 'tint-down', 4.5, 'delta malo'], ['ink-warn', 'tint-warn', 4.5, 'advertencia'],
  ['ui-danger', 'ui-danger-soft', 4.5, 'error'], ['ui-warning', 'ui-warning-soft', 4.5, 'advertencia'], ['pf-ok', 'pf-ok-soft', 4.5, 'éxito (plataforma)'], ['pf-bad', 'pf-bad-soft', 4.5, 'peligro (plataforma)'],
  ['ink', 'kind-observed-soft', 4.5, 'insignia Observado'], ['ink', 'kind-estimated-soft', 4.5, 'insignia Estimado'], ['ink', 'kind-inferred-soft', 4.5, 'insignia Inferido'],
  // UI y gráficas (3:1)
  ['ui-focus', 'background', 3, 'anillo de foco'], ['ui-focus', 'ui-surface', 3, 'anillo de foco'], ['ui-input', 'ui-surface', 3, 'borde de campo'], ['ui-highlight', 'ui-surface', 3, 'resaltado rojo'],
  ['kind-observed', 'ui-surface', 3, 'serie principal'], ['kind-estimated', 'ui-surface', 3, 'serie estimada'], ['kind-inferred', 'ui-surface', 3, 'serie inferida'],
  ['cov-in', 'ui-surface', 3, 'cobertura'], ['cov-rej', 'ui-surface', 3, 'cobertura rechazada'], ['cov-pen', 'ui-surface', 3, 'cobertura pendiente'],
  ['ch-4', 'ui-surface', 3, 'categoría 4'], ['ch-5', 'ui-surface', 3, 'categoría 5'], ['ch-neutral', 'ui-surface', 3, 'comparativa'],
  ['heat-4', 'ui-surface', 3, 'mapa de calor, extremo'], ['heat-3', 'ui-surface', 3, 'mapa de calor'],
  ['chart-bar', 'ui-surface', 3, 'barras (tinta al 85 %)'], ['chart-bar-strong', 'ui-surface', 3, 'barra del último mes completo'], ['chart-bar-estimated', 'ui-surface', 3, 'barras estimadas'], ['chart-bar-inferred', 'ui-surface', 3, 'barras inferidas'], ['chart-accent', 'ui-surface', 3, 'rojo de marca: valor seleccionado'], ['chart-hatch', 'ui-surface', 3, 'trama de mes parcial'], ['chart-tick', 'ui-surface', 4.5, 'texto de ejes de 11 px'], ['chart-label', 'ui-surface', 4.5, 'etiquetas directas'],
  ['fg-walmart', 'ui-surface', 3, 'canal 1'], ['fg-amazon', 'ui-surface', 3, 'canal 2'], ['fg-otro', 'ui-surface', 3, 'otros canales'],
];
for (const [nombre, T] of [['claro', LIGHT], ['oscuro', DARK]]) {
  test(`contraste WCAG AA, tema ${nombre}: parejas de texto, UI y gráficas`, () => {
    const fallos = [];
    for (const [fg, bg, min, motivo] of PAREJAS) { const r = ratio(val(T, fg), val(T, bg)); if (r < min) fallos.push(`--${fg} sobre --${bg}: ${r.toFixed(2)}:1 < ${min} (${motivo})`); }
    assert.deepEqual(fallos, []);
  });
  test(`barras de gráfica (inactiva, estimada, inferida, plena y resaltado) a >= 3:1 del fondo y la plena más contrastada que la inactiva, tema ${nombre}`, () => {
    const fondo = val(T, 'ui-surface');
    for (const k of ['chart-bar', 'chart-bar-estimated', 'chart-bar-inferred', 'chart-bar-strong', 'chart-accent']) assert.ok(ratio(val(T, k), fondo) >= 3, k);
    assert.ok(ratio(val(T, 'chart-bar-strong'), fondo) >= ratio(val(T, 'chart-bar'), fondo), 'el último mes completo no puede verse más débil que el resto');
  });
  test(`la rampa de calor crece monótona en luminosidad (gris a negro / a blanco), tema ${nombre}`, () => {
    const L = [0, 1, 2, 3, 4].map(i => lum(val(T, 'heat-' + i)));
    const asc = L.every((v, i) => i === 0 || v > L[i - 1]), desc = L.every((v, i) => i === 0 || v < L[i - 1]);
    assert.ok(asc || desc);
  });
  test(`no hay azul en los tokens de interfaz, tema ${nombre}`, () => {
    const azules = Object.entries(T).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v)).filter(([, v]) => { const [r, g, b] = hex(v); return b - Math.max(r, g) > 24; }).map(([k, v]) => k + ' ' + v);
    assert.deepEqual(azules, []);
  });
}
test('el peligro no se confunde con el rojo de marca: tono distinto (matiz) y siempre con fondo propio', () => {
  const hue = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const marca = hue(val(LIGHT, 'rovaq-rojo')), peligro = hue(val(LIGHT, 'ui-danger'));
  assert.ok(Math.abs(marca - peligro) >= 8 || Math.abs(marca - peligro) >= 8, `matiz marca ${marca.toFixed(0)} vs peligro ${peligro.toFixed(0)}`);
  assert.notEqual(LIGHT['ui-danger'].toLowerCase(), LIGHT['rovaq-rojo'].toLowerCase());
  assert.notEqual(LIGHT['pf-bad'].toLowerCase(), LIGHT['rovaq-rojo'].toLowerCase());
});
test('marca: tokens base del kit', () => {
  assert.equal(LIGHT['rovaq-negro'].toLowerCase(), '#0e0e10'); assert.equal(LIGHT['rovaq-rojo'].toLowerCase(), '#e8241c'); assert.equal(LIGHT['rovaq-blanco'].toLowerCase(), '#ffffff');
  assert.equal(LIGHT['ui-action'].toLowerCase(), '#0e0e10'); assert.equal(DARK['background'].toLowerCase(), '#0e0e10');
});
