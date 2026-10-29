// Caparazón móvil: contratos estáticos que no dependen de un navegador (la medición real vive en tests/ui/movil.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const layout = leer('src/app/(app)/layout.tsx'), shell = leer('src/components/workspace/shell.tsx'), movil = leer('src/components/workspace/movil.tsx');
const css = leer('src/components/workspace/movil.css'), manifest = JSON.parse(leer('public/site.webmanifest'));
test('viewport-fit=cover, interactive-widget y theme-color claro/oscuro', () => {
  assert.match(layout, /viewportFit:\s*"cover"/);assert.match(layout, /interactiveWidget:\s*"resizes-content"/);
  assert.match(layout, /prefers-color-scheme: light[\s\S]*prefers-color-scheme: dark/);
});
test('el tema se aplica antes del primer pintado desde <head> (sin destello) y el shell no arranca en «light»', () => {
  assert.match(layout, /<head>(?:<style[^>]*>\{[A-Z_]+\}<\/style>)?<script dangerouslySetInnerHTML=\{\{ __html: TEMA_ANTES_DEL_PINTADO \}\}/); // en <head>, antes de cualquier otro script y del cuerpoassert.match(layout, /localStorage\.getItem\('vexa-theme'\)/);assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(shell, /useState<Theme\|null>\(null\)/);assert.doesNotMatch(shell, /useState<Theme>\('light'\)/);
});
test('barra inferior: 5 destinos fijos con etiqueta (Inicio, Dinero, Clientes, Acciones, Preguntar)', () => {
  for (const e of ['inicio', 'dinero', 'clientes', 'acciones', 'preguntar']) assert.match(movil, new RegExp("etiqueta:'movil\\." + e + "'"));// los rótulos viven en lib/i18n/es.ts (Inicio, Dinero, Clientes, Acciones, Preguntar)
  assert.equal((movil.match(/\{href:'\/[a-z]+'/g) ?? []).length, 6, '5 destinos + el sustituto «Datos» para roles sin Dinero');
  assert.match(css, /\.bn-etiqueta\{[^}]*text-overflow:ellipsis/);
});
test('encabezado móvil: logo de Rovaq (enlace a Inicio) y empresa como monograma; sin texto de cliente ni avatar circular', () => {
  assert.match(shell, /<Link href="\/overview" className="header-logo"[^>]*><RovaqLogo variante="horizontal"/);assert.match(shell, /import \{RovaqLogo\} from '\.\.\/rovaq-logo'/);
  assert.match(shell, /<SelectorEmpresa organizations=\{organizations\} tenant=\{tenant\}\/>/);
  assert.doesNotMatch(shell, /workspace-header[^`]*hidden=/, 'en celular el encabezado no se oculta ni en el chat');
  assert.doesNotMatch(movil, /empresa-fija/, 'sin un chip con el nombre del cliente en la barra');
  assert.match(movil, /if\(!varias\)return null/);
});
test('selector de empresa: varias organizaciones abren la hoja inferior y POST /auth/organization; el control es un monograma, no el nombre', () => {
  assert.match(movil, /action="\/auth\/organization" method="post"/);assert.match(movil, /<Drawer side="bottom"/);assert.match(movil, /name="tenant_id" value=\{o\.id\}/);
  assert.match(movil, /aria-label=\{t\('movil\.empresaActual',\{nombre\}\)\}/);// «Empresa: {nombre}. Cambiar de empresa» en el diccionario
  const chip = movil.slice(movil.indexOf('className="empresa-chip"'), movil.indexOf('<Drawer side="bottom" title="Cambiar de empresa"'));
  assert.doesNotMatch(chip, /org-nombre/, 'el nombre completo vive en la hoja, no en la barra');
});
test('monograma unificado: rectángulo redondeado con tinte (radio 8), nunca círculo; misma clase en barra, hoja, pie del sidebar y plataforma', () => {
  const g = leer('src/app/(app)/globals.css'), p = leer('src/app/(app)/platform/layout.tsx');
  assert.match(g, /\.monograma \{[^}]*border-radius:8px[^}]*color-mix/);assert.doesNotMatch(g, /account-avatar|org-avatar/);assert.doesNotMatch(css + shell + movil + p, /account-avatar|org-avatar/);
  assert.match(shell, /<Monograma nombre=\{organization\}\/>/);assert.match(p, /className="monograma"/);
});
test('iniciales del monograma: dos palabras → una letra de cada una; una palabra → dos letras; ignora conectores y paréntesis', () => {
  const m = movil.match(/export function iniciales[\s\S]*?\n\}\n/)[0].replace('export function iniciales(nombre:string)', 'function iniciales(nombre)');
  const iniciales = new Function(m + '; return iniciales;')();
  assert.equal(iniciales('PILOTO'), 'PI');assert.equal(iniciales('Los Tacos de PM'), 'TP');assert.equal(iniciales('Organización de demostración (sintética)'), 'OD');assert.equal(iniciales('Rovaq AI'), 'RA');assert.equal(iniciales('  '), '?');
});
test('selector de tema: iconos SVG iguales, sin glifos de texto y sin title', () => {
  assert.doesNotMatch(shell + movil, /['"]☀['"]|['"]☾['"]|['"]▣['"]/);assert.match(movil, /\['light','shell\.temaClaro','sun'\],\['system','shell\.temaSistema','monitor'\],\['dark','shell\.temaOscuro','moon'\]/);assert.match(movil, /size=\{16\}/);
});
test('chat: UNA página — el marco mide 100dvh menos el teclado, el compositor queda anclado al fondo (sin position:fixed) y la textarea es de 16 px', () => {
  const u = leer('src/components/agente/una-pagina.css');
  assert.match(u, /\.workspace-shell\.workspace-chat\{height:calc\(100dvh - var\(--teclado,0px\)\)/);
  assert.match(u, /html\[data-teclado=abierto\] \.workspace-shell\.workspace-chat \.workspace-frame \.workspace-content\{padding-bottom:8px\}/);
  assert.match(u, /padding:4px max\(12px,env\(safe-area-inset-right\)\) calc\(var\(--nav-total,84px\) \+ 8px\)/, 'reserva la barra inferior');
  assert.match(u, /agente-composer textarea\{font-size:16px/);
  assert.doesNotMatch(u, /agente-dock\{position:fixed/);
  assert.match(u, /html:has\(\.workspace-chat\),html:has\(\.workspace-chat\) body\{height:100dvh;overflow:hidden/);
  assert.match(movil, /visualViewport/);
});
test('PWA: manifest instalable con iconos maskable 192 y 512', () => {
  assert.equal(manifest.display, 'standalone');
  for (const s of ['192x192', '512x512']) assert.ok(manifest.icons.some(i => i.sizes === s && i.purpose === 'maskable'), 'maskable ' + s);
});
