// Caparazón móvil: contratos estáticos que no dependen de un navegador (la medición real vive en tests/ui/movil.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const layout = leer('src/app/layout.tsx'), shell = leer('src/components/workspace/shell.tsx'), movil = leer('src/components/workspace/movil.tsx');
const css = leer('src/components/workspace/movil.css'), manifest = JSON.parse(leer('public/site.webmanifest'));
test('viewport-fit=cover, interactive-widget y theme-color claro/oscuro', () => {
  assert.match(layout, /viewportFit:\s*"cover"/);assert.match(layout, /interactiveWidget:\s*"resizes-content"/);
  assert.match(layout, /prefers-color-scheme: light[\s\S]*prefers-color-scheme: dark/);
});
test('el tema se aplica antes del primer pintado desde <head> (sin destello) y el shell no arranca en «light»', () => {
  assert.match(layout, /<head><script dangerouslySetInnerHTML/);assert.match(layout, /localStorage\.getItem\('vexa-theme'\)/);assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(shell, /useState<Theme\|null>\(null\)/);assert.doesNotMatch(shell, /useState<Theme>\('light'\)/);
});
test('barra inferior: 5 destinos fijos con etiqueta (Inicio, Dinero, Clientes, Acciones, Preguntar)', () => {
  for (const e of ['Inicio', 'Dinero', 'Clientes', 'Acciones', 'Preguntar']) assert.match(movil, new RegExp("etiqueta:'" + e + "'"));
  assert.equal((movil.match(/\{href:'\/[a-z]+'/g) ?? []).length, 6, '5 destinos + el sustituto «Datos» para roles sin Dinero');
  assert.match(css, /\.bn-etiqueta\{[^}]*text-overflow:ellipsis/);
});
test('selector de empresa siempre visible; con varias organizaciones abre la hoja inferior y POST /auth/organization; con una sola es texto sin control', () => {
  assert.match(movil, /action="\/auth\/organization" method="post"/);assert.match(movil, /<Drawer side="bottom"/);assert.match(movil, /name="tenant_id" value=\{o\.id\}/);
  assert.match(movil, /if\(!varias\)return <div className="empresa-chip empresa-fija"/);assert.match(shell, /<SelectorEmpresa organizations=\{organizations\} tenant=\{tenant\}\/>/);
  assert.doesNotMatch(shell, /workspace-header[^`]*hidden=/, 'en celular el encabezado con la empresa no se oculta ni en el chat');
});
test('selector de tema: iconos SVG iguales, sin glifos de texto y sin title', () => {
  assert.doesNotMatch(shell + movil, /['"]☀['"]|['"]☾['"]|['"]▣['"]/);assert.match(movil, /\['light','Claro','sun'\],\['system','Sistema','monitor'\],\['dark','Oscuro','moon'\]/);assert.match(movil, /size=\{16\}/);
});
test('chat: compositor fijo sobre la barra inferior y el teclado, textarea de 16 px', () => {
  const a = leer('src/components/agente/agente.css');
  assert.match(a, /\.workspace-chat \.agente-dock\{position:fixed/);assert.match(a, /data-teclado=abierto\] \.workspace-chat \.agente-dock\{bottom:var\(--teclado/);assert.match(a, /agente-composer textarea\{font-size:16px/);
  assert.match(movil, /visualViewport/);
});
test('PWA: manifest instalable con iconos maskable 192 y 512', () => {
  assert.equal(manifest.display, 'standalone');
  for (const s of ['192x192', '512x512']) assert.ok(manifest.icons.some(i => i.sizes === s && i.purpose === 'maskable'), 'maskable ' + s);
});
