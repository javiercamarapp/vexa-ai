import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, catalogForModel, toolsForRole, validateArgs, toJsonSchema, contractViolations, numbersGrounded, numbersIn, LIMITS } from '../index.mjs';

test('el catálogo es cerrado y cada herramienta declara descripción, lecturas, método, fuente y esquema estricto', () => {
  assert.equal(TOOLS.length, 18);
  assert.equal(new Set(TOOLS.map((t) => t.name)).size, TOOLS.length);
  for (const t of TOOLS) {
    assert.ok(t.description.length > 20, t.name); assert.ok(t.reads.length > 0, t.name); assert.ok(t.method.length > 30, t.name); assert.ok(t.source.ref.startsWith('agent:'), t.name);
    const js = toJsonSchema(t.parameters); assert.equal(js.additionalProperties, false);
    for (const forbidden of ['tenant', 'tenantId', 'tenant_id', 'organization', 'org', 'role', 'rol', 'sql', 'query', 'user', 'userId']) assert.ok(!(forbidden in js.properties), `${t.name} acepta ${forbidden}`);
  }
});
test('el catálogo para el modelo depende del rol: viewer y operator no ven citas ni clientes', () => {
  for (const role of ['viewer', 'operator']) { const n = catalogForModel(role).map((t) => t.name); assert.ok(!n.includes('evidencias_de_problema') && !n.includes('clientes_por_problema')); assert.equal(n.length, 10); }
  for (const role of ['analyst', 'owner']) assert.equal(toolsForRole(role).length, 18);
  assert.equal(toolsForRole('intruso').length, 0);
});
test('validateArgs: rechaza claves desconocidas, tipos, rangos, control y prototipos', () => {
  const s = TOOLS.find((t) => t.name === 'problemas_top').parameters;
  assert.deepEqual(validateArgs(s, {}).args, { limit: 5 });
  assert.equal(validateArgs(s, { limit: 3, month: '2026-09' }).ok, true);
  for (const bad of [{ tenant_id: 'x' }, { limit: 0 }, { limit: 11 }, { limit: '5' }, { limit: 2.5 }, { month: '2026-13' }, { month: 'septiembre' }, 'texto', [1], { ['__proto__']: 1 }]) assert.equal(validateArgs(s, bad).ok, false, JSON.stringify(bad));
  assert.equal(validateArgs(s, JSON.parse('{"__proto__":{"x":1}}')).ok, false);
  const p = TOOLS.find((t) => t.name === 'evidencias_de_problema').parameters;
  assert.equal(validateArgs(p, { problema: 'ab' }).ok, false);
  assert.equal(validateArgs(p, { problema: 'x'.repeat(121) }).ok, false);
  assert.equal(validateArgs(p, { problema: 'producto\u0000dañado' }).ok, false);
  assert.equal(validateArgs(p, {}).ok, false);
});
test('contractViolations: una cifra sin clase o sin cobertura invalida la respuesta', () => {
  const ok = { status: 'ok', text: 'x', figures: [{ id: 'a', class: 'observed', coverage: { known_n: 1, eligible_n: 2 } }], blocks: [], sources: [{ ref: 'r' }], calc: [{}], citations: [] };
  assert.deepEqual(contractViolations(ok), []);
  assert.ok(contractViolations({ ...ok, figures: [{ id: 'a', coverage: { known_n: 1, eligible_n: 2 } }] }).some((v) => /sin clase/.test(v)));
  assert.ok(contractViolations({ ...ok, figures: [{ id: 'a', class: 'observed' }] }).some((v) => /sin cobertura/.test(v)));
  assert.ok(contractViolations({ ...ok, figures: [{ id: 'a', class: 'observed', coverage: { known_n: 3, eligible_n: 2 } }] }).some((v) => /sin cobertura/.test(v)));
  assert.ok(contractViolations({ ...ok, figures: [{ id: 'a', class: 'certain', coverage: { known_n: 1, eligible_n: 2 } }] }).length > 0);
  assert.ok(contractViolations({ ...ok, blocks: [{ title: 't', class: 'observed', coverage: null, columns: [], rows: [] }] }).some((v) => /bloque sin cobertura/.test(v)));
  assert.ok(contractViolations({ ...ok, citations: [{ messageRevisionId: 'no-uuid', quote: 'q' }] }).some((v) => /origen verificable/.test(v)));
  assert.ok(contractViolations({ ...ok, sources: [] }).some((v) => /sin fuentes/.test(v)));
  assert.ok(contractViolations({ ...ok, blocks: [{ title: 't', class: 'observed', coverage: { known_n: 1, eligible_n: null }, columns: [], rows: [] }] }).some((v) => /sin cobertura/.test(v)));
  assert.ok(contractViolations({ ...ok, blocks: [{ title: 't', class: 'observed', coverage: { known_n: 1, eligible_n: 1 }, columns: [], rows: Array.from({ length: LIMITS.maxRowsPerBlock + 1 }, () => ({})) }] }).some((v) => /demasiado largo/.test(v)));
});
test('numbersGrounded: un número inventado invalida el texto; los que vienen de los resultados pasan', () => {
  const allowed = numbersIn([{ display: '184,523.00 USD', n: 214 }, 'cobertura 812 de 1,000']);
  assert.equal(numbersGrounded('Fueron 184,523.00 USD en 214 incidencias, 812 de 1,000.', allowed), true);
  assert.equal(numbersGrounded('Fueron 999,999,999 USD.', allowed), false);
  assert.equal(numbersGrounded('Subió 37 %.', allowed), false);
  assert.equal(numbersGrounded('Sin cifras aquí.', allowed), true);
});
