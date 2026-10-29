// Tokens del núcleo de diseño (DISENO-ACUERDO §4): oscuro con jerarquía correcta, rojo único, radios cerrados y tamaño mínimo de texto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
const src = join(import.meta.dirname, '../src');
const css = (f) => readFileSync(join(src, f), 'utf8');
// El sitio público (src/styles/sitio) tiene su propio sistema de diseño (prefijo s-, tokens propios) y su propia auditoría (tools/sitio, arnés de CSS de T6): no entra en la escala del espacio de trabajo.
const todos = (d = src) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (p === join(src, 'styles', 'sitio') ? [] : todos(p)) : p.endsWith('.css') ? [p] : []; });
const oscuro = [...css('app/(app)/globals.css').matchAll(/:root\[data-theme=dark\]\s*\{([^}]*)\}/g)].map((m) => m[1]).join(' ');
const tok = (n) => new RegExp('--' + n + ':\\s*(#[0-9a-f]{6})', 'i').exec(oscuro)?.[1].toLowerCase();
const lum = (h) => [1, 3, 5].reduce((a, i, k) => { let c = parseInt(h.slice(i, i + 2), 16) / 255; c = c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; return a + c * [.2126, .7152, .0722][k]; }, 0);
test('oscuro: hundido < superficie < elevado, y sin sombras (elevación por borde)', () => {
  const [h, s, e] = [tok('ui-sunken'), tok('ui-surface'), tok('ui-elevated')];
  assert.deepEqual([h, s, e], ['#0e0e10', '#17171a', '#1f1f23']);
  assert.ok(lum(h) < lum(s) && lum(s) < lum(e));
  assert.match(oscuro, /--ui-shadow:\s*none/);
});
test('rojo señal: un solo valor #E8241C en ambos temas; #FF5A52 retirado', () => {
  for (const f of todos()) assert.ok(!/ff5a52/i.test(readFileSync(f, 'utf8')), 'queda #ff5a52 en ' + f);
  assert.equal(tok('ui-highlight'), '#e8241c'); assert.equal(tok('chart-accent'), '#e8241c');
});
test('radios: conjunto cerrado {8 controles, 12 tarjetas, 999 chips, 50 %}, sin otros px sueltos fuera del login', () => {
  const malos = [];
  for (const f of todos()) for (const l0 of readFileSync(f, 'utf8').split('\n')) {
    if (/^\.login|\.access-symbol/.test(l0)) continue;
    // Hoja inferior del celular (drawer anclado abajo): esquinas superiores de 16 px por decisión de diseño móvil (24-oct).
    const l = l0.replace(/border-radius:\s*16px 16px 0 0/g, '');
    for (const m of l.matchAll(/border-radius:\s*(1|2|3|4|5|6|7|9|10|11|13|14|15|16|18|20|22|24)px/g)) malos.push(f.replace(src, '') + ' ' + m[0]);
  }
  assert.deepEqual(malos, []);
});
test('tipografía: ningún texto de lectura por debajo de 12 px (11 px solo en etiquetas en mayúsculas)', () => {
  const malos = [];
  for (const f of todos()) for (const m of readFileSync(f, 'utf8').matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const b = m[2].replace(/\s/g, '');
    if (!/font(-size)?:[^;]*\b(9|10|11)px/.test(b) || /tick/.test(m[1])) continue; // ticks de ejes de gráfica: 11 px permitidos
    if (/\b(9|10)px/.test(b.match(/font(-size)?:[^;]*/g).join(' ')) || !/text-transform:uppercase/.test(b)) malos.push(f.replace(src, '') + ' ' + m[1].trim().slice(0, 60));
  }
  assert.deepEqual(malos, []);
});
test('h1 con tracking -0.02em y cifras tabulares globales', () => {
  const g = css('app/(app)/globals.css');
  assert.match(g, /\.workspace-shell h1 \{[^}]*letter-spacing:-\.02em/); assert.match(g, /font-variant-numeric:tabular-nums/);
});
test('titular de Fuga: cifra en tinta plena (nunca gris), 24-28 px y peso 600 (escala compacta)', () => {
  const css = readFileSync(join(src, 'components/refunds/fuga.css'), 'utf8');
  const r = /\.workspace-content \.fg-big(?:,\.workspace-content section>p\.fg-big)?\{([^}]*)\}/.exec(css)[1];
  assert.match(r, /color:var\(--ink\)/); assert.match(r, /font:600 clamp\(24px,3vw,28px\)/);
});
