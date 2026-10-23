import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MENU, menuVisible, itemActivo, tituloDePantalla, todosLosItems, cerradosGuardados, grupoAbiertoPorDefecto} from '../src/lib/workspace/menu.mjs';
const etiquetas = (acceso) => menuVisible(acceso).map((e) => e.etiqueta);
const hrefs = (acceso) => menuVisible(acceso).flatMap((e) => (e.tipo === 'grupo' ? e.items : [e]).map((i) => i.href));

test('orden de la historia: Resumen, Problemas, Pregúntale a tus datos, Dinero, Recomendaciones, Acciones, Explorador, Brief, Datos y fuentes, Administración, Interno', () => {
  assert.deepEqual(etiquetas({role: 'owner', interno: true}), ['Resumen', 'Problemas', 'Pregúntale a tus datos', 'Dinero', 'Recomendaciones', 'Acciones', 'Explorador', 'Brief ejecutivo', 'Datos y fuentes', 'Administración', 'Interno']);
});
test('Interno solo con acceso de plataforma; un propietario cliente no lo ve', () => {
  assert.ok(!etiquetas({role: 'owner'}).includes('Interno'));
  assert.ok(!hrefs({role: 'owner'}).some((h) => ['/evaluation', '/evaluation/candidates', '/migrations'].includes(h)));
  assert.deepEqual(menuVisible({role: 'viewer', interno: true}).find((e) => e.etiqueta === 'Interno').items.map((i) => i.href), ['/evaluation', '/evaluation/candidates', '/migrations']);
});
test('Administración solo propietarios; Dinero solo propietario y analista', () => {
  for (const role of ['analyst', 'operator', 'viewer', undefined]) assert.ok(!etiquetas({role}).includes('Administración'), String(role));
  assert.ok(etiquetas({role: 'owner'}).includes('Administración'));
  for (const role of ['owner', 'analyst']) assert.ok(hrefs({role}).includes('/economics') && hrefs({role}).includes('/cfo') && hrefs({role}).includes('/refunds'));
  for (const role of ['operator', 'viewer', undefined]) assert.ok(!hrefs({role}).includes('/economics') && !hrefs({role}).includes('/cfo') && !hrefs({role}).includes('/refunds'));
});
test('Notificaciones y Gestionar problemas ya no son ítems; Gestión económica pasa a Dinero > Preparar', () => {
  const todos = todosLosItems().map(({item}) => item.href);
  assert.ok(!todos.includes('/notifications') && !todos.includes('/problems/manage'));
  const dinero = MENU.find((e) => e.clave === 'dinero');
  assert.deepEqual(dinero.items.map((i) => [i.href, i.etiqueta]), [['/cfo', 'Panorama'], ['/refunds', 'Fuga de reembolsos'], ['/economics', 'Preparar']]);
});
test('ítem activo: /jobs/:id -> Importaciones, /analysis/:id -> Análisis, /problems/manage -> Problemas, el más específico gana', () => {
  const act = (p) => itemActivo(p)?.item.href;
  assert.equal(act('/jobs/abc'), '/imports'); assert.equal(act('/jobs/setup'), '/imports'); assert.equal(act('/imports'), '/imports');
  assert.equal(act('/analysis/xyz'), '/analysis'); assert.equal(act('/problems/manage'), '/problems'); assert.equal(act('/problems/p1'), '/problems');
  assert.equal(act('/evaluation/candidates'), '/evaluation/candidates'); assert.equal(act('/evaluation'), '/evaluation');
  assert.equal(act('/notifications/push'), '/settings/notifications'); assert.equal(act('/settings/notification-delivery'), '/settings/notifications');
  assert.equal(itemActivo('/jobs/abc').grupo, 'datos');
  assert.equal(itemActivo('/notifications'), null); assert.equal(itemActivo('/ruta-rara'), null);
});
test('ninguna ruta del menú anterior se pierde: todas siguen teniendo ítem o título propio', () => {
  for (const ruta of ['/overview', '/problems', '/problems/manage', '/recommendations', '/explorer', '/preguntale', '/interventions', '/briefs', '/cfo', '/refunds', '/analysis', '/imports', '/connections', '/sources', '/history', '/evaluation', '/evaluation/candidates', '/migrations', '/economics', '/notifications', '/settings/notifications', '/settings/team', '/settings/retention', '/settings/notification-delivery', '/notifications/push', '/jobs/setup', '/customers/1'])
    assert.notEqual(tituloDePantalla(ruta), 'Espacio de trabajo', ruta);
});
test('estado recordado: solo claves de grupo válidas; texto roto = todos abiertos', () => {
  assert.deepEqual(cerradosGuardados('["datos","inventado",3]'), ['datos']);
  assert.deepEqual(cerradosGuardados('no es json'), []); assert.deepEqual(cerradosGuardados(null), []); assert.deepEqual(cerradosGuardados('{"a":1}'), []);
});
test('A6: Cobertura de datos y Fuentes conectadas ya no se confunden en el menú', () => {
  const items = todosLosItems().map((x) => x.item).filter((i) => ['/sources', '/connections'].includes(i.href));
  assert.deepEqual(items.map((i) => i.etiqueta), ['Cobertura de datos', 'Fuentes conectadas']);
  assert.equal(tituloDePantalla('/sources'), 'Cobertura de datos');
});

test('acordeón: un solo grupo abierto por defecto; el de la página actual o el primero', () => {
  const menu = menuVisible({ role: 'owner', interno: false });
  const primero = menu.find((e) => e.tipo === 'grupo').clave;
  assert.equal(grupoAbiertoPorDefecto(menu, itemActivo('/overview')), primero);
  assert.equal(grupoAbiertoPorDefecto(menu, null), primero);
  assert.equal(grupoAbiertoPorDefecto(menu, itemActivo('/connections')), 'datos');
  assert.equal(grupoAbiertoPorDefecto(menu, itemActivo('/settings/team')), 'administracion');
  assert.equal(grupoAbiertoPorDefecto([], null), null);
});
