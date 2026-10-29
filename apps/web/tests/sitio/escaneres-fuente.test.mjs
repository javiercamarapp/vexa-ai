// Escáner de fuentes del sitio (SPEC 9.2 y 9.3): sin style, eval, innerHTML, 'use client',
// ni nada que vuelva dinámica una ruta. Las carpetas que aún no existen quedan pendientes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { listarArchivos, escanearFuente, rel, leer } from './_escaner.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARPETAS = [
  ['src/components/sitio', 'T7, T8 y T9'],
  ['src/content/sitio', 'T11'],
  ['src/app/(sitio)', 'T1 y T7'],
  ['src/lib/sitio', 'T2 y T11'],
  ['src/sitio-js', 'T5 y T10'],
];

test('el escáner detecta cada patrón prohibido (fixtures malos)', () => {
  const malo = [
    'const a = <div style="x">hola</div>;',
    'const b = <p style={{ color: "red" }} />;',
    'el.setAttribute("style", "x");',
    'el.innerHTML = datos;',
    'eval("1");',
    'new Function("return 1");',
    'document.write("x");',
    'await import("https://cdn.ejemplo.com/x.js");',
    'WebAssembly.instantiate(b);',
    "'use client';\nexport default 1;",
    'const c = cookies();',
    'const h = headers();',
    'draftMode();',
    'await connection();',
    'export default function P({ searchParams }) {}',
    '<div dangerouslySetInnerHTML={{ __html: x }} />',
  ].join('\n---\n').split('\n---\n');
  for (const f of malo) assert.ok(escanearFuente(f).length > 0, `no detectó: ${f}`);
});

test('el escáner deja pasar código limpio y comentarios', () => {
  const bueno = [
    '// no uses style= ni eval( aquí\nconst x = 1;',
    '/* innerHTML = x */ const y = 2;',
    'const u = "https://rovaq.ai/x";',
    '<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: j }} />',
    'el.style.setProperty("--p", "0.5");',
  ];
  for (const f of bueno) assert.deepEqual(escanearFuente(f), [], f);
});

for (const [dir, tarea] of CARPETAS) {
  const ruta = join(WEB, dir);
  const hay = existsSync(ruta);
  test(`fuentes limpias en ${dir}`, { skip: hay ? false : `PENDIENTE: ${dir} aún no existe (lo crea ${tarea})` }, () => {
    const archivos = listarArchivos(ruta, ['.ts', '.tsx', '.js', '.mjs', '.jsx']).filter((f) => !/\.test\./.test(f));
    const hall = archivos.flatMap((f) => escanearFuente(leer(f), rel(WEB, f)));
    assert.deepEqual(hall.map((h) => `${h.archivo}:${h.linea} ${h.regla}`), []);
  });
}
