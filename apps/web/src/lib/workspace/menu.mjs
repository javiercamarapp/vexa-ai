// Menú del espacio de trabajo, ordenado como la historia del producto: ver -> entender -> decidir -> actuar -> medir.
// Ocultar un ítem del menú NO protege su pantalla: la autorización sigue siendo la del servidor. Aquí solo se decide qué se le ofrece a cada quien.
import { DATABASE_ACTION_ROLES } from '@vexa/platform/capabilities';
const SOLO_PROPIETARIO = ['owner'];
// Avisos propios: los roles se derivan de la capacidad real «notify» del servidor (db.ts), nunca se copian aquí.
const AVISOS = [...DATABASE_ACTION_ROLES.notify];
const DINERO = ['owner', 'analyst'];
/** Roles que ven cifras de dinero (CFO, Brechas, Fuga, Carga): el servidor responde 403 al resto. Las pantallas mixtas no deben pedirles esos endpoints. */
export const ROLES_DINERO = Object.freeze([...DINERO]);
// Configuración es de lectura: los roles salen de la capacidad «read» del servidor (db.ts), nunca se copian aquí.
const LECTURA = [...DATABASE_ACTION_ROLES.read];
/** Entradas de primer nivel: ítems sueltos o grupos con ítems. `alias` = rutas que se muestran bajo ese ítem sin ser su ruta. */
export const MENU = Object.freeze([
  // 8 espacios, en el orden de la historia: ver -> entender -> decidir -> confiar. «Brief ejecutivo» se absorbe en Hoy («Exportar informe»); su ruta /briefs sigue viva.
  { tipo: 'item', href: '/overview', etiqueta: 'Hoy', icono: 'overview', titulo: 'Hoy' },
  { tipo: 'item', href: '/preguntale', etiqueta: 'Pregúntale a tus datos', icono: 'preguntale' },
  { tipo: 'grupo', clave: 'dinero', etiqueta: 'Dinero', roles: DINERO, items: [
    // El nombre «CFO» se conserva hasta que Javier decida otro (la propuesta es «Panorama financiero»).
    { href: '/cfo', etiqueta: 'CFO', icono: 'economics', titulo: 'CFO' },
    { href: '/gaps', etiqueta: 'Brechas de ingreso', icono: 'economics', titulo: 'Brechas de ingreso' },
    { href: '/refunds', etiqueta: 'Fuga de reembolsos', icono: 'economics', titulo: 'Fuga de reembolsos' },
  ] },
  { tipo: 'grupo', clave: 'clientes', etiqueta: 'Clientes y problemas', items: [
    { href: '/problems', etiqueta: 'Problemas', icono: 'problems', alias: ['/problems/manage'] },
    { href: '/pain-points', etiqueta: 'Puntos de dolor', icono: 'painpoints', titulo: 'Puntos de dolor', roles: DINERO },
  ] },
  { tipo: 'grupo', clave: 'operacion', etiqueta: 'Operación', roles: DINERO, items: [
    { href: '/map', etiqueta: 'Mapa de problemas', icono: 'grid', titulo: 'Mapa de problemas' },
    { href: '/workload', etiqueta: 'Carga y SLA', icono: 'clock', titulo: 'Carga y SLA' },
  ] },
  // Recomendaciones y Acciones son un solo ciclo: propuesta -> decisión -> resultado. Por decidir = recomendaciones; En curso y Resultados = intervenciones.
  { tipo: 'grupo', clave: 'acciones', etiqueta: 'Acciones', items: [
    { href: '/recommendations', etiqueta: 'Por decidir', icono: 'recommendations', titulo: 'Acciones · Por decidir' },
    { href: '/interventions', etiqueta: 'En curso y resultados', icono: 'interventions', titulo: 'Acciones' },
  ] },
  { tipo: 'grupo', clave: 'datos', etiqueta: 'Datos y confianza', items: [
    { href: '/confianza', etiqueta: 'Confianza', icono: 'history', titulo: 'Datos y confianza' },
    { href: '/sources', etiqueta: 'Cobertura de datos', icono: 'history', titulo: 'Cobertura de datos' },
    { href: '/connections', etiqueta: 'Fuentes conectadas', icono: 'connections', titulo: 'Fuentes conectadas' },
    { href: '/imports', etiqueta: 'Importaciones', icono: 'imports', alias: ['/jobs'] },
    { href: '/history', etiqueta: 'Histórico e identidad', icono: 'history' },
    { href: '/analysis', etiqueta: 'Análisis', icono: 'analysis', titulo: 'Análisis de conversaciones' },
    { href: '/economics', etiqueta: 'Cortes publicados', icono: 'imports', titulo: 'Cortes publicados', roles: DINERO },
    { href: '/explorer', etiqueta: 'Explorador', icono: 'explorer' },
  ] },
  // Avisos propios (preferencias, bandeja y dispositivos): de cada persona, no de la administración. La política de entrega de la organización sigue en Administración.
  { tipo: 'item', href: '/settings/notifications', etiqueta: 'Avisos', icono: 'avisos', titulo: 'Preferencias de avisos', alias: ['/notifications/push'], roles: AVISOS },
  // Configuración (/setup): estado de la configuración de la organización, solo lectura y según el rol. Lo ven los cuatro roles; los pasos que su rol no puede hacer se muestran sin enlace.
  { tipo: 'item', href: '/setup', etiqueta: 'Configuración', icono: 'check', titulo: 'Configuración', roles: LECTURA },
  { tipo: 'grupo', clave: 'administracion', etiqueta: 'Administración', roles: SOLO_PROPIETARIO, items: [
    { href: '/settings/team', etiqueta: 'Equipo', icono: 'team' },
    { href: '/settings/notification-delivery', etiqueta: 'Entrega de avisos', icono: 'avisos' },
    { href: '/settings/retention', etiqueta: 'Retención', icono: 'retention', titulo: 'Retención y borrado' },
  ] },
  // Interno: fuera del menú del cliente; solo lo ve el equipo de Rovaq (acceso de plataforma).
  { tipo: 'grupo', clave: 'interno', etiqueta: 'Interno', interno: true, items: [
    { href: '/evaluation', etiqueta: 'Evaluación histórica', icono: 'analysis' },
    { href: '/evaluation/candidates', etiqueta: 'Candidatos evaluados', icono: 'recommendations' },
    { href: '/migrations', etiqueta: 'Comparación de migración', icono: 'connections' },
  ] },
]);
/** Pantallas sin ítem propio (se llega por la campana o por otra pantalla): solo aportan título e icono. */
const SIN_ITEM = Object.freeze([
  { href: '/notifications', etiqueta: 'Notificaciones', icono: 'notifications' },
  { href: '/briefs', etiqueta: 'Informe ejecutivo', icono: 'briefs' },
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
export const todosLosItems = () => [...MENU.flatMap((e) => (e.tipo === 'grupo' ? e.items.map((item) => ({ item, grupo: e.clave })) : [{ item: e, grupo: null }]))];
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
