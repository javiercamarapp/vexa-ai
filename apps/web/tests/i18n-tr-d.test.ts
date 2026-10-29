// Traducción grupo D (consola de plataforma: resumen, organizaciones, fuentes, procesos, costos de IA, alertas, auditoría, ficha 360, copiloto y verificación en dos pasos):
// paridad es/en de d-tr-d, sin texto fijo en español en los archivos migrados y reglas de la casa para el inglés.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trDEs, trDEn} from '../src/lib/i18n/d-tr-d';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {traductor} from '../src/lib/i18n';
import {FIXTURE_DETAIL, relative, signals, sourceRows, type OrgDetail} from '../src/lib/platform/ficha-model';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const variables = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const ES = trDEs as Record<string, string>, EN = trDEn as Record<string, string>;
/** Código sin comentarios: la prueba mira texto que se pinta, no la documentación en español. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

test('d-tr-d: las claves tr.* son idénticas en es y en, sin vacíos, con las mismas {variables}', () => {
  const ke = Object.keys(ES).sort(), kn = Object.keys(EN).sort();
  assert.ok(ke.length > 300, 'diccionario con contenido: ' + ke.length);
  assert.deepEqual(kn.filter((k) => !ke.includes(k)), [], 'claves solo en inglés');
  assert.deepEqual(ke.filter((k) => !kn.includes(k)), [], 'claves solo en español');
  for (const k of ke) {
    assert.ok(k.startsWith('tr.'), 'prefijo tr.: ' + k);
    assert.ok(ES[k].trim() && EN[k].trim(), 'vacío: ' + k);
    assert.equal(variables(EN[k]), variables(ES[k]), 'variables distintas: ' + k);
    assert.equal((es as Record<string, string>)[k], ES[k], 'es.ts incorpora ' + k);
    assert.equal((en as Record<string, string>)[k], EN[k], 'en.ts incorpora ' + k);
  }
});

test('d-tr-d: el inglés no lleva letras acentuadas del español, signos invertidos ni paréntesis, y las cifras entran por {variable}', () => {
  for (const [k, v] of Object.entries(EN)) {
    assert.doesNotMatch(v, /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/, 'acento en inglés: ' + k);
    assert.doesNotMatch(v, /[()]/, 'paréntesis en inglés: ' + k);
    assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, 'emoji en inglés: ' + k);
    assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /(^|[^\w.-])\d{2,}/, 'cifra escrita a mano en inglés: ' + k);
  }
  for (const [k, v] of Object.entries(ES)) {
    assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, 'emoji en español: ' + k);
    assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /(^|[^\w.-])\d{2,}/, 'cifra escrita a mano en español: ' + k);
  }
});

// Archivos migrados: toda clave literal que usan existe en los dos idiomas con las variables que pasan, y no queda el texto fijo en español.
const PROHIBIDOS: Record<string, string[]> = {
  'src/components/platform/platform-views.tsx': ['Resumen de plataforma', 'Exportar CSV', 'Reintentar seleccionados', 'Bitácora administrativa', 'Crear organización', 'Gasto de IA del mes', 'Confirmo que quiero', 'Sin procesos fallidos', 'Solo faltantes', 'Datos sintéticos', 'Acceso administrativo'],
  'src/components/platform/org-ficha.tsx': ['Ficha de cliente', 'Salud de datos y frescura', 'Entradas de soporte', 'Gestionar equipo', 'Todavía no se ha preparado', "'Envejeciendo'", 'Requiere reconexión'],
  'src/components/platform/copilot-panel.tsx': ['Nueva conversación', 'Descargar CSV', 'Presupuesto agotado', 'Demasiadas preguntas', 'Consulta directa', 'Preguntas sugeridas'],
  'src/components/platform/mfa-panel.tsx': ['Activar con app', 'Verificar sesión', 'Cancelar inscripción', 'Escanea el código', 'Código de 6'],
  'src/components/platform/primitives.tsx': ['Cómo se calculó', 'Sin tope', '% del tope'],
  'src/lib/platform/ficha-model.ts': ['Hace un momento', 'Sin registro', 'Cargas manuales', 'necesita reconectarse', 'Invitación enviada', 'Terminó el administrador'],
};

test('grupo D: los archivos migrados no vuelven a llevar el texto fijo en español', () => {
  for (const [archivo, textos] of Object.entries(PROHIBIDOS)) {
    const codigo = sinComentarios(leer(archivo));
    for (const t of textos) assert.ok(!codigo.includes(t), `${archivo}: reapareció «${t}»`);
  }
});

test('grupo D: toda clave tr.pl.* que usan los archivos migrados existe en español e inglés y recibe sus variables', () => {
  // Claves cuyas variables se arman fuera de la llamada (objeto ya construido o nombre calculado).
  const INDIRECTAS = new Set(['tr.pl.howProy']);
  const archivos = [...Object.keys(PROHIBIDOS), 'src/app/(app)/seguridad/page.tsx'];
  const usadas = new Set<string>();
  for (const archivo of archivos) {
    const codigo = leer(archivo);
    for (const m of codigo.matchAll(/'(tr\.pl\.[\w]+)'/g)) assert.ok(m[1] in ES, `${archivo}: la clave ${m[1]} no existe`);
    for (const m of codigo.matchAll(/\bt\('(tr\.pl\.[\w]+)'/g)) {
      const clave = m[1]; usadas.add(clave);
      const pedidas = variables(ES[clave]).split(',').filter(Boolean);
      if (pedidas.length === 0 || INDIRECTAS.has(clave)) continue;
      const ventana = codigo.slice(m.index!, m.index! + 700);
      for (const v of pedidas) assert.match(ventana, new RegExp(`[{,]\\s*${v}\\s*[:,}]`), `${archivo}: ${clave} no recibe {${v}}`);
    }
  }
  assert.ok(usadas.size > 150, 'se usan las claves del grupo: ' + usadas.size);
});

test('grupo D: ninguna clave del diccionario queda sin usar en los archivos de la consola', () => {
  const codigo = ['src/components/platform/platform-views.tsx', 'src/components/platform/org-ficha.tsx', 'src/components/platform/copilot-panel.tsx', 'src/components/platform/mfa-panel.tsx', 'src/components/platform/primitives.tsx', 'src/lib/platform/ficha-model.ts'].map(leer).join('\n');
  const huerfanas = Object.keys(ES).filter((k) => !codigo.includes(`'${k}'`));
  assert.deepEqual(huerfanas, [], 'claves sin uso');
});

test('grupo D: /seguridad da el idioma al panel de verificación en dos pasos', () => {
  const pagina = leer('src/app/(app)/seguridad/page.tsx');
  assert.match(pagina, /<IdiomaLocal idioma=\{idioma\}><MfaPanel/);
});

test('ficha-model: señales y tiempo relativo salen en el idioma del traductor y en español por omisión', () => {
  const NOW = Date.UTC(2026, 9, 24, 12, 0, 0), H = 3600_000;
  const d: OrgDetail = {...FIXTURE_DETAIL('02000000-0000-4000-8000-000000000002', NOW), members: {owner: 0, analyst: 1, operator: 0, viewer: 0, total: 1}};
  const tEn = traductor('en');
  const textosEn = signals(d, NOW, tEn).map((s) => s.text);
  assert.ok(textosEn.length >= 3);
  for (const x of textosEn) assert.doesNotMatch(x, /[áéíóúñ¿¡]|proceso|invitaci|dueño/i, x);
  assert.ok(textosEn.some((x) => /Zendesk is not updating/.test(x)));
  assert.ok(signals(d, NOW).some((s) => /Zendesk no se está actualizando/.test(s.text)));
  assert.equal(relative(new Date(NOW - 3 * H).toISOString(), NOW, tEn), '3 h ago');
  assert.equal(relative(new Date(NOW - 3 * H).toISOString(), NOW), 'Hace 3 h');
  assert.equal(sourceRows(d, NOW, tEn).find((r) => r.source === 'sin_conexion')!.label, 'Manual uploads');
});
