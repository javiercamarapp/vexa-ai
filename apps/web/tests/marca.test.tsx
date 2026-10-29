// Marca Rovaq (kit de logotipo): el componente único, los activos públicos y las exportaciones HTML usan el mismo logotipo y nada de la marca anterior.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {RovaqLogo, RovaqLogoLateral} from '../src/components/rovaq-logo';
import {RovaqMark} from '../src/components/agente/rovaq-mark';
import {RovaqCargando} from '../src/components/rovaq-cargando';
import {LOGOS, MINIMOS, ROVAQ, rovaqLogoSvg, espacioLibreEn} from '../../../packages/workspace-service/marca.mjs';

const pub = (f: string) => readFileSync(join(import.meta.dirname, '../public', f), 'utf8');
const trazos = (svg: string) => [...svg.matchAll(/<path fill="#(?:0E0E10|FFFFFF)" d="([^"]+)"/g)].map(m => m[1]);

test('los trazos del módulo son exactamente los del kit copiado a public/brand (positivo y negativo)', () => {
  for (const [variante, archivo] of [['horizontal', 'horizontal'], ['simbolo', 'simbolo']] as const) {
    for (const tono of ['positivo', 'negativo']) {
      const svg = pub(`brand/rovaq-${archivo === 'horizontal' ? 'logo-horizontal' : 'simbolo'}-${tono}.svg`);
      assert.deepEqual(trazos(svg), [...LOGOS[variante].tinta], `${variante} ${tono}`);
      assert.match(svg, /<circle fill="#E8241C"/, 'el punto es rojo señal en ambos tonos');
      assert.equal(trazos(svg).length > 0 && svg.includes(tono === 'positivo' ? '#0E0E10' : '#FFFFFF'), true);
    }
  }
});

test('RovaqLogo: alt «Rovaq», tamaños mínimos del kit, espacio libre de 2 diámetros del punto y tono por tema solo con CSS', () => {
  const h = renderToStaticMarkup(<RovaqLogo variante="horizontal" ancho={40}/>);
  assert.match(h, /aria-label="Rovaq"/); assert.match(h, /role="img"/); assert.match(h, /data-tono="auto"/);
  assert.match(h, new RegExp(`width="${MINIMOS.horizontal}"`), 'el horizontal nunca baja de 100 px');
  assert.match(renderToStaticMarkup(<RovaqLogo variante="simbolo" ancho={4}/>), new RegExp(`width="${MINIMOS.simbolo}"`));
  const pad = espacioLibreEn('horizontal', 100); assert.ok(pad > 12 && pad < 13, 'dos diámetros del punto = ~12,3 % del ancho');
  assert.ok(h.includes(`padding:${espacioLibreEn('horizontal', 100)}px`));
  assert.ok(!renderToStaticMarkup(<RovaqLogo espacioLibre={false}/>).includes('padding'));
  assert.match(renderToStaticMarkup(<RovaqLogo decorativo/>), /aria-hidden="true"/);
  assert.match(renderToStaticMarkup(<RovaqLogo tono="contraste"/>), /data-tono="contraste"/);
  assert.match(h, /fill="#E8241C"/); assert.equal((h.match(/fill="#0E0E10"/g) ?? []).length, LOGOS.horizontal.tinta.length);
  const lateral = renderToStaticMarkup(<RovaqLogoLateral/>);
  assert.match(lateral, /rovaq-logo-expandido/); assert.match(lateral, /rovaq-logo-colapsado/);
  const css = readFileSync(join(import.meta.dirname, '../src/app/(app)/globals.css'), 'utf8');
  assert.match(css, /--rovaq-logo-tinta:var\(--rovaq-negro\)/); assert.match(css, /:root\[data-theme=dark\] \{ --rovaq-logo-tinta:var\(--rovaq-blanco\)/);
  assert.match(css, /\.rovaq-logo-tinta \{ fill:var\(--rovaq-tinta\)/);
});

test('rovaqLogoSvg (exportaciones): positivo en tinta negra, negativo en blanca, punto siempre rojo', () => {
  const p = rovaqLogoSvg({ancho: 120}), n = rovaqLogoSvg({tono: 'negativo', variante: 'simbolo', ancho: 24});
  assert.ok(p.includes(`fill="${ROVAQ.negro}"`) && !p.includes(ROVAQ.blanco)); assert.ok(p.includes(`fill="${ROVAQ.rojo}"`));
  assert.ok(n.includes(`fill="${ROVAQ.blanco}"`) && !n.includes(ROVAQ.negro) && n.includes(ROVAQ.rojo));
  assert.match(p, /aria-label="Rovaq"/); assert.throws(() => rovaqLogoSvg({variante: 'x' as never}));
});

test('RovaqMark: usa el símbolo del kit; la órbita solo existe en «thinking» y se mantiene el contrato de estado', () => {
  const idle = renderToStaticMarkup(<RovaqMark/>), think = renderToStaticMarkup(<RovaqMark thinking/>);
  assert.ok(!idle.includes('rovaq-orbit')); assert.match(idle, /data-state="idle"/); assert.match(think, /data-state="thinking"[\s\S]*rovaq-orbit/);
  assert.match(idle, /fill="#E8241C"/);
});

test('favicon completo, manifiestos y metadata apuntan al kit; el símbolo de aviso es el del kit', () => {
  for (const f of ['favicon.ico', 'favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest', 'brand/rovaq-app-icon.svg', 'brand/rovaq-logo-horizontal-positivo-600px.png'])
    assert.ok(existsSync(join(import.meta.dirname, '../public', f)) && statSync(join(import.meta.dirname, '../public', f)).size > 100, f);
  assert.equal(pub('push-icon.svg'), pub('favicon.svg'));
  for (const f of ['site.webmanifest', 'push-manifest.webmanifest']) { const m = JSON.parse(pub(f)); assert.equal(m.theme_color, '#0E0E10'); assert.equal(m.background_color, '#0E0E10'); assert.match(m.name, /^Rovaq/); }
  const layout = readFileSync(join(import.meta.dirname, '../src/app/(app)/layout.tsx'), 'utf8');
  assert.match(layout, /themeColor: \[[^\]]*"#ffffff"[^\]]*"#0e0e10"/i); // claro y oscuro; el manifiesto fija #0E0E10 assert.match(layout, /manifest: "\/site\.webmanifest"/); assert.match(layout, /apple-touch-icon\.png/); assert.match(layout, /favicon\.svg/);
});

test('no queda la marca anterior (la «R» azul): ni componentes, ni íconos, ni colores de marca vieja', () => {
  assert.ok(!existsSync(join(import.meta.dirname, '../src/components/vexa-brand.tsx')));
  assert.ok(!existsSync(join(import.meta.dirname, '../src/app/icon.svg')));
  const raiz = join(import.meta.dirname, '..');
  const archivos: string[] = [];
  const recorrer = (d: string) => { for (const e of readdirSync(d)) { if (e === 'node_modules' || e === '.next') continue; const p = join(d, e); if (statSync(p).isDirectory()) recorrer(p); else if (/\.(tsx?|mjs|css|svg|webmanifest|json)$/.test(e)) archivos.push(p); } };
  recorrer(join(raiz, 'src')); recorrer(join(raiz, 'public'));
  const viejo = /VexaBrand|vexa-brand|rovaq-tile|rovaq-r\b|M20 47V17h14\.5|fill="#254edb"|#166534/;
  assert.deepEqual(archivos.filter(f => viejo.test(readFileSync(f, 'utf8'))).map(f => f.replace(raiz, '')), []);
});

test('pantalla de carga (igual a la de Likida): SOLO el logo respirando, accesible, con el punto rojo dentro del mismo SVG (no se separa del anillo)', () => {
  const html = renderToStaticMarkup(<RovaqCargando mensaje="Cargando tu espacio de trabajo…"/>);
  assert.match(html, /role="status"/); assert.match(html, /aria-busy="true"/);
  assert.match(html, /rovaq-respira/); assert.match(html, /aria-label="Cargando tu espacio de trabajo…"/); assert.doesNotMatch(html, /<p[ >]/, 'sin texto visible: solo el logo');
  assert.equal((html.match(/<svg/g) ?? []).length, 1, 'un solo logo');
  assert.equal((html.match(new RegExp('fill="' + ROVAQ.rojo + '"', 'g')) ?? []).length, 1, 'un solo punto rojo, en el mismo SVG');
  assert.doesNotMatch(html, /#254edb|#6aaff0/i, 'sin azul de la marca anterior');
  const compacto = renderToStaticMarkup(<RovaqCargando compacto/>);
  assert.match(compacto, /rovaq-cargando-compacto/); assert.match(compacto, /rovaq-logo-simbolo/);
});

test('la animación del logo (respira, como Likida) respeta reducir movimiento y solo cambia opacidad y escala', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/app/(app)/globals.css'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[^}]*\.rovaq-respira/s);
  const anim = css.slice(css.indexOf('@keyframes rovaq-respira'), css.indexOf('.rovaq-respira {'));
  assert.doesNotMatch(anim, /rotate|translate|skew/, 'el kit prohíbe rotar o deformar el logo');
  assert.match(anim, /opacity/); assert.match(anim, /scale/);
});
