import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MENU, menuVisible, itemActivo, tituloDePantalla, todosLosItems, cerradosGuardados, grupoAbiertoPorDefecto} from '../src/lib/workspace/menu.mjs';
const etiquetas = (acceso) => menuVisible(acceso).map((e) => e.etiqueta);
const hrefs = (acceso) => menuVisible(acceso).flatMap((e) => (e.tipo === 'grupo' ? e.items : [e]).map((i) => i.href));

test('8 espacios + Avisos propios en el orden de la historia (ver, entender, decidir, confiar) + Interno solo para plataforma', () => {
  assert.deepEqual(etiquetas({role: 'owner'}), ['Hoy', 'Pregúntale a tus datos', 'Dinero', 'Clientes y problemas', 'Operación', 'Acciones', 'Datos y confianza', 'Avisos', 'Administración']);
  assert.deepEqual(etiquetas({role: 'owner', interno: true}), ['Hoy', 'Pregúntale a tus datos', 'Dinero', 'Clientes y problemas', 'Operación', 'Acciones', 'Datos y confianza', 'Avisos', 'Administración', 'Interno']);
});
test('Brief y Recomendaciones ya no son entradas de primer nivel: Brief se absorbe en Hoy, Recomendaciones vive en Acciones > Por decidir', () => {
  assert.ok(!etiquetas({role: 'owner'}).some((e) => ['Brief ejecutivo', 'Recomendaciones', 'Explorador', 'Resumen', 'Problemas'].includes(e)));
  const acciones = MENU.find((e) => e.clave === 'acciones');
  assert.deepEqual(acciones.items.map((i) => [i.href, i.etiqueta]), [['/recommendations', 'Por decidir'], ['/interventions', 'En curso y resultados']]);
  assert.equal(itemActivo('/briefs/abc'), null); assert.equal(tituloDePantalla('/briefs'), 'Informe ejecutivo');
});
test('Explorador y Preparar viven dentro de Datos y confianza; Preparar solo propietario y analista', () => {
  const datos = MENU.find((e) => e.clave === 'datos');
  assert.equal(datos.etiqueta, 'Datos y confianza');
  assert.ok(datos.items.some((i) => i.href === '/explorer') && datos.items.some((i) => i.href === '/economics') && datos.items[0].href === '/confianza');
  for (const role of ['operator', 'viewer', undefined]) assert.ok(!hrefs({role}).includes('/economics') && hrefs({role}).includes('/explorer') && hrefs({role}).includes('/confianza'), String(role));
  assert.equal(itemActivo('/explorer').grupo, 'datos'); assert.equal(itemActivo('/economics').grupo, 'datos');
});
test('Interno solo con acceso de plataforma; un propietario cliente no lo ve', () => {
  assert.ok(!etiquetas({role: 'owner'}).includes('Interno'));
  assert.ok(!hrefs({role: 'owner'}).some((h) => ['/evaluation', '/evaluation/candidates', '/migrations'].includes(h)));
  assert.deepEqual(menuVisible({role: 'viewer', interno: true}).find((e) => e.etiqueta === 'Interno').items.map((i) => i.href), ['/evaluation', '/evaluation/candidates', '/migrations']);
});
test('Administración solo propietarios (Equipo, Entrega de avisos, Retención); Dinero solo propietario y analista', () => {
  for (const role of ['analyst', 'operator', 'viewer', undefined]) assert.ok(!etiquetas({role}).includes('Administración'), String(role));
  assert.ok(etiquetas({role: 'owner'}).includes('Administración'));
  for (const role of ['owner', 'analyst']) assert.ok(hrefs({role}).includes('/economics') && hrefs({role}).includes('/cfo') && hrefs({role}).includes('/refunds') && hrefs({role}).includes('/gaps'));
  for (const role of ['operator', 'viewer', undefined]) assert.ok(!hrefs({role}).includes('/economics') && !hrefs({role}).includes('/cfo') && !hrefs({role}).includes('/refunds') && !hrefs({role}).includes('/gaps'));
});
test('Notificaciones y Gestionar problemas ya no son ítems; Dinero conserva CFO, Brechas y Fuga (Preparar pasó a Datos y confianza)', () => {
  const todos = todosLosItems().map(({item}) => item.href);
  assert.ok(!todos.includes('/notifications') && !todos.includes('/problems/manage'));
  const dinero = MENU.find((e) => e.clave === 'dinero');
  assert.deepEqual(dinero.items.map((i) => [i.href, i.etiqueta]), [['/cfo', 'CFO'], ['/gaps', 'Brechas de ingreso'], ['/refunds', 'Fuga de reembolsos']]);
});
test('ítem activo: /jobs/:id -> Importaciones, /analysis/:id -> Análisis, /problems/manage -> Problemas, el más específico gana', () => {
  const act = (p) => itemActivo(p)?.item.href;
  assert.equal(act('/jobs/abc'), '/imports'); assert.equal(act('/jobs/setup'), '/imports'); assert.equal(act('/imports'), '/imports');
  assert.equal(act('/analysis/xyz'), '/analysis'); assert.equal(act('/problems/manage'), '/problems'); assert.equal(act('/problems/p1'), '/problems');
  assert.equal(act('/evaluation/candidates'), '/evaluation/candidates'); assert.equal(act('/evaluation'), '/evaluation');
  assert.equal(act('/notifications/push'), '/settings/notifications'); assert.equal(act('/settings/notification-delivery'), '/settings/notification-delivery');
  assert.equal(itemActivo('/jobs/abc').grupo, 'datos');
  assert.equal(itemActivo('/notifications'), null); assert.equal(itemActivo('/ruta-rara'), null);
});
test('ninguna ruta del menú anterior se pierde: todas siguen teniendo ítem o título propio', () => {
  for (const ruta of ['/overview', '/problems', '/problems/manage', '/recommendations', '/explorer', '/preguntale', '/interventions', '/briefs', '/cfo', '/gaps', '/refunds', '/analysis', '/imports', '/connections', '/sources', '/history', '/evaluation', '/evaluation/candidates', '/migrations', '/economics', '/notifications', '/settings/notifications', '/settings/team', '/settings/retention', '/settings/notification-delivery', '/notifications/push', '/jobs/setup', '/customers/1', '/confianza', '/briefs/x'])
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
  assert.equal(primero, 'dinero');
  assert.equal(grupoAbiertoPorDefecto(menu, itemActivo('/overview')), primero);
  assert.equal(grupoAbiertoPorDefecto(menu, itemActivo('/recommendations')), 'acciones');
  assert.equal(grupoAbiertoPorDefecto(menu, itemActivo('/problems/manage')), 'clientes');
  assert.equal(grupoAbiertoPorDefecto(menu, null), primero);
  assert.equal(grupoAbiertoPorDefecto(menu, itemActivo('/connections')), 'datos');
  assert.equal(grupoAbiertoPorDefecto(menu, itemActivo('/settings/team')), 'administracion');
  assert.equal(grupoAbiertoPorDefecto([], null), null);
});

test('Operación (Mapa de problemas, Carga y SLA): solo propietario y analista; el ítem activo resuelve /map y /workload', () => {
  for (const role of ['owner', 'analyst']) assert.ok(hrefs({role}).includes('/map') && hrefs({role}).includes('/workload'));
  for (const role of ['operator', 'viewer', undefined]) assert.ok(!hrefs({role}).includes('/map') && !hrefs({role}).includes('/workload'));
  assert.equal(itemActivo('/map')?.item.href, '/map'); assert.equal(tituloDePantalla('/workload'), 'Carga y SLA');
});

test('Avisos propios: los 4 roles lo ven fuera de Administración; sin rol no; la política de entrega sigue siendo solo del propietario', () => {
  for (const role of ['owner', 'analyst', 'operator', 'viewer']) {
    assert.ok(hrefs({role}).includes('/settings/notifications'), role);
    assert.ok(etiquetas({role}).includes('Avisos'), role);
    assert.equal(menuVisible({role}).find((e) => e.etiqueta === 'Avisos').tipo, 'item', 'Avisos es un ítem propio, no cuelga de Administración');
  }
  assert.ok(!hrefs({role: undefined}).includes('/settings/notifications'));
  const admin = MENU.find((e) => e.clave === 'administracion');
  assert.deepEqual(admin.items.map((i) => i.href), ['/settings/team', '/settings/notification-delivery', '/settings/retention']);
  for (const role of ['analyst', 'operator', 'viewer']) assert.ok(!hrefs({role}).includes('/settings/notification-delivery') && !hrefs({role}).includes('/settings/team'), role);
});
test('los roles de Avisos salen de la capacidad notify del servidor, no de una copia', async () => {
  const {DATABASE_ACTION_ROLES} = await import('@vexa/platform/capabilities');
  const item = MENU.find((e) => e.href === '/settings/notifications');
  assert.deepEqual([...item.roles].sort(), [...DATABASE_ACTION_ROLES.notify].sort());
});
