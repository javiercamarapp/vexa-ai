// Menú del espacio de trabajo, ordenado como la historia del producto: ver -> entender -> decidir -> actuar -> medir.
// Ocultar un ítem del menú NO protege su pantalla: la autorización sigue siendo la del servidor. Aquí solo se decide qué se le ofrece a cada quien.
const SOLO_PROPIETARIO = ['owner'];
const DINERO = ['owner', 'analyst'];
/** Entradas de primer nivel: ítems sueltos o grupos con ítems. `alias` = rutas que se muestran bajo ese ítem sin ser su ruta. */
export const MENU = Object.freeze([
  { tipo: 'item', href: '/overview', etiqueta: 'Resumen', icono: 'overview' },
  { tipo: 'item', href: '/problems', etiqueta: 'Problemas', icono: 'problems', alias: ['/problems/manage'] },
  { tipo: 'item', href: '/preguntale', etiqueta: 'Pregúntale a tus datos', icono: 'preguntale' },
  { tipo: 'grupo', clave: 'dinero', etiqueta: 'Dinero', roles: DINERO, items: [
    { href: '/cfo', etiqueta: 'Panorama', icono: 'economics', titulo: 'Dinero' },
    { href: '/gaps', etiqueta: 'Brechas de ingreso', icono: 'economics', titulo: 'Brechas de ingreso' },
    { href: '/refunds', etiqueta: 'Fuga de reembolsos', icono: 'economics', titulo: 'Fuga de reembolsos' },
    { href: '/economics', etiqueta: 'Preparar', icono: 'imports', titulo: 'Dinero · Preparar' },
  ] },
  { tipo: 'item', href: '/recommendations', etiqueta: 'Recomendaciones', icono: 'recommendations' },
  { tipo: 'item', href: '/interventions', etiqueta: 'Acciones', icono: 'interventions' },
  { tipo: 'item', href: '/explorer', etiqueta: 'Explorador', icono: 'explorer' },
  { tipo: 'item', href: '/briefs', etiqueta: 'Brief ejecutivo', icono: 'briefs' },
  { tipo: 'grupo', clave: 'operacion', etiqueta: 'Operación', roles: DINERO, items: [
    { href: '/map', etiqueta: 'Mapa de problemas', icono: 'grid', titulo: 'Mapa de problemas' },
    { href: '/workload', etiqueta: 'Carga y SLA', icono: 'clock', titulo: 'Carga y SLA' },
  ] },
  { tipo: 'grupo', clave: 'datos', etiqueta: 'Datos y fuentes', items: [
    { href: '/sources', etiqueta: 'Cobertura de datos', icono: 'history', titulo: 'Cobertura de datos' },
    { href: '/connections', etiqueta: 'Fuentes conectadas', icono: 'connections', titulo: 'Fuentes conectadas' },
    { href: '/imports', etiqueta: 'Importaciones', icono: 'imports', alias: ['/jobs'] },
    { href: '/history', etiqueta: 'Histórico e identidad', icono: 'history' },
    { href: '/analysis', etiqueta: 'Análisis', icono: 'analysis', titulo: 'Análisis de conversaciones' },
  ] },
  { tipo: 'grupo', clave: 'administracion', etiqueta: 'Administración', roles: SOLO_PROPIETARIO, items: [
    { href: '/settings/team', etiqueta: 'Equipo', icono: 'team' },
    { href: '/settings/notifications', etiqueta: 'Avisos', icono: 'settings', titulo: 'Preferencias de avisos', alias: ['/settings/notification-delivery', '/notifications/push'] },
    { href: '/settings/retention', etiqueta: 'Retención', icono: 'settings', titulo: 'Retención y borrado' },
  ] },
  { tipo: 'grupo', clave: 'interno', etiqueta: 'Interno', interno: true, items: [
    { href: '/evaluation', etiqueta: 'Evaluación histórica', icono: 'analysis' },
    { href: '/evaluation/candidates', etiqueta: 'Candidatos evaluados', icono: 'recommendations' },
    { href: '/migrations', etiqueta: 'Comparación de migración', icono: 'connections' },
  ] },
]);
/** Pantallas sin ítem propio (se llega por la campana o por otra pantalla): solo aportan título e icono. */
const SIN_ITEM = Object.freeze([
  { href: '/notifications', etiqueta: 'Notificaciones', icono: 'notifications' },
  { href: '/customers', etiqueta: 'Historial del cliente', icono: 'customers' },
]);
const ve = (entrada, { role, interno }) => (entrada.interno ? Boolean(interno) : !entrada.roles || (role !== undefined && entrada.roles.includes(role)));
/** Menú que ve cada quien. `role` = rol en la organización; `interno` = acceso de plataforma (equipo de Rovaq). */
export function menuVisible({ role, interno = false } = {}) {
  return MENU.filter((e) => ve(e, { role, interno })).map((e) => (e.tipo === 'grupo' ? { ...e, items: e.items.filter((i) => ve(i, { role, interno })) } : e)).filter((e) => e.tipo === 'item' || e.items.length > 0);
}
const rutas = (item) => [item.href, ...(item.alias ?? [])];
const coincide = (pathname, ruta) => pathname === ruta || pathname.startsWith(ruta + '/');
/** Todos los ítems del menú completo (sin filtrar por permisos) con su grupo. */
export const todosLosItems = () => MENU.flatMap((e) => (e.tipo === 'grupo' ? e.items.map((item) => ({ item, grupo: e.clave })) : [{ item: e, grupo: null }]));
/** Ítem activo para una ruta: la coincidencia más específica gana (/evaluation/candidates antes que /evaluation; /jobs/:id -> Importaciones; /problems/manage -> Problemas). */
export function itemActivo(pathname) {
  let mejor = null;
  for (const { item, grupo } of todosLosItems()) for (const ruta of rutas(item)) if (coincide(pathname, ruta) && (!mejor || ruta.length > mejor.largo)) mejor = { item, grupo, largo: ruta.length };
  return mejor ? { item: mejor.item, grupo: mejor.grupo } : null;
}
/** Título para el encabezado de la pantalla. */
export function tituloDePantalla(pathname) {
  const a = itemActivo(pathname);
  if (a) return a.item.titulo ?? a.item.etiqueta;
  return SIN_ITEM.find((s) => coincide(pathname, s.href))?.etiqueta ?? 'Espacio de trabajo';
}
export function iconoDePantalla(pathname) {
  const a = itemActivo(pathname);
  if (a) return a.item.icono;
  return SIN_ITEM.find((s) => coincide(pathname, s.href))?.icono ?? 'overview';
}
/** Acordeón: UN solo grupo abierto a la vez. Por defecto el de la página actual; si la página no está en un grupo, el primero del menú visible. */
export function grupoAbiertoPorDefecto(entradas, activo) {
  const claves = entradas.filter((e) => e.tipo === 'grupo').map((g) => g.clave);
  if (activo?.grupo && claves.includes(activo.grupo)) return activo.grupo;
  return claves[0] ?? null;
}
/** Grupos cerrados por el usuario (por defecto todos abiertos). Lee y valida lo guardado; cualquier cosa rara = todos abiertos. */
export function cerradosGuardados(texto) {
  try {
    const v = JSON.parse(texto ?? '[]');
    const claves = new Set(MENU.filter((e) => e.tipo === 'grupo').map((g) => g.clave));
    return Array.isArray(v) ? v.filter((c) => typeof c === 'string' && claves.has(c)) : [];
  } catch { return []; }
}
