// Catálogo único del onboarding: qué pasos tiene cada pista, qué capacidad exige cada uno y a qué pantalla lleva.
// La capacidad es una de las acciones REALES del servidor (packages/platform/src/capabilities.ts, que usa db.ts); los roles que la tienen se
// derivan de esa tabla, nunca se copian aquí. Una prueba falla si un rol recibe un paso cuya capacidad no tiene, o un href que menuVisible() no le muestra.
// Este archivo solo DECLARA: no consulta datos ni escribe nada. Los textos viven en el diccionario i18n (claves onb.*).
import { DATABASE_ACTION_ROLES } from '@vexa/platform/capabilities';

/** Pistas de onboarding. Cuatro son roles de organización; «plataforma» y «soporte» no son un rol. */
export const PISTAS = Object.freeze(['propietario', 'analista', 'operador', 'lector', 'plataforma', 'soporte']);
/** Rol de organización de cada pista (null = no es un rol de organización). */
export const ROL_DE_PISTA = Object.freeze({ propietario: 'owner', analista: 'analyst', operador: 'operator', lector: 'viewer', plataforma: null, soporte: null });
/** Acciones del servidor (las 10 de db.ts) y los roles que las tienen. */
export const ACCIONES = Object.freeze(Object.keys(DATABASE_ACTION_ROLES));
/** Acciones que escriben o cambian estado; el resto (read, notify, materialize, export) solo leen/preparan/avisan. «materialize» prepara cortes y no publica. */
export const ACCIONES_DE_ESCRITURA = Object.freeze(['import', 'configure', 'propose', 'approve', 'execute', 'retain']);
/** Prerrequisitos derivables de datos (declaración: la consulta real llega en una fase posterior). `tercero` = depende de alguien ajeno: se muestra «esperando a», no cuenta para el progreso. */
export const PRERREQUISITOS = Object.freeze({
  conexion_activa: { fuente: 'connections', tercero: 'crm' },
  historial_importado: { fuente: 'imports', tercero: null },
  corte_publicado: { fuente: 'economics', tercero: null },
  equipo_invitado: { fuente: 'team', tercero: 'correo' },
  accion_propuesta: { fuente: 'interventions', tercero: null },
  resultado_registrado: { fuente: 'interventions', tercero: null },
});

const t = (pista, id) => ({ titulo: `onb.${pista}.${id}.titulo`, cuerpo: `onb.${pista}.${id}.cuerpo` });
/** surf: 'tour' (tarjeta de recorrido, máx. 5 por pista) o 'checklist' (lista de activación, máx. 4). */
/** `espera` = quien debe actuar cuando este rol NO puede (p. ej. el analista prepara el corte pero lo publica el propietario): el paso queda «en espera» y no cuenta. */
const paso = (pista, id, accion, href, surf = 'tour', prerrequisito = null, espera = null) => Object.freeze({ id: `${pista}.${id}`, pista, accion, href, superficie: surf, prerrequisito, espera, textos: t(pista, id) });

export const CATALOGO = Object.freeze([
  // Propietario: todo el espacio de su organización.
  paso('propietario', 'hoy', 'read', '/overview'),
  paso('propietario', 'datos', 'configure', '/connections', 'tour', 'conexion_activa'),
  paso('propietario', 'confianza', 'read', '/confianza'),
  paso('propietario', 'problema', 'read', '/problems'),
  paso('propietario', 'acciones', 'approve', '/recommendations'),
  paso('propietario', 'historial', 'import', '/imports', 'checklist', 'historial_importado'),
  paso('propietario', 'corte', 'materialize', '/economics', 'checklist', 'corte_publicado'),
  paso('propietario', 'equipo', 'configure', '/settings/team', 'checklist', 'equipo_invitado'),
  paso('propietario', 'retencion', 'retain', '/settings/retention', 'checklist'),
  // Analista: lee, propone e importa historial; no aprueba ni configura.
  paso('analista', 'hoy', 'read', '/overview'),
  paso('analista', 'problemas', 'read', '/problems'),
  paso('analista', 'dinero', 'read', '/cfo'),
  paso('analista', 'importar', 'import', '/imports', 'tour', 'historial_importado'),
  paso('analista', 'preguntar', 'read', '/preguntale'),
  paso('analista', 'corte', 'materialize', '/economics', 'checklist', 'corte_publicado', 'propietario'),
  paso('analista', 'informe', 'export', '/overview', 'checklist'),
  // Operador: propone y ejecuta intervenciones; no ve dinero ni importa.
  paso('operador', 'hoy', 'read', '/overview'),
  paso('operador', 'problemas', 'read', '/problems'),
  paso('operador', 'acciones', 'execute', '/interventions'),
  paso('operador', 'preguntar', 'read', '/preguntale'),
  paso('operador', 'propuesta', 'propose', '/recommendations', 'checklist', 'accion_propuesta'),
  paso('operador', 'resultado', 'execute', '/interventions', 'checklist', 'resultado_registrado'),
  // Lector: solo mira; ningún paso con botón de escritura.
  paso('lector', 'hoy', 'read', '/overview'),
  paso('lector', 'problemas', 'read', '/problems'),
  paso('lector', 'confianza', 'read', '/confianza'),
  // Administrador de plataforma: dentro de /platform (no es un rol de organización; no pasa por menuVisible).
  paso('plataforma', 'resumen', 'read', '/platform'),
  paso('plataforma', 'organizaciones', 'read', '/platform/organizaciones'),
  paso('plataforma', 'costos', 'read', '/platform/costos-ia'),
  paso('plataforma', 'auditoria', 'read', '/platform/auditoria'),
  // Sesión de soporte «Ver como»: un solo aviso, sin acción, sin enlace, sin escritura.
  paso('soporte', 'aviso', 'read', null),
]);

export const pasosDe = (pista, superficie) => CATALOGO.filter((p) => p.pista === pista && (!superficie || p.superficie === superficie));
/** Roles de organización que tienen la capacidad de un paso (derivado de db.ts). */
export const rolesConCapacidad = (accion) => [...(DATABASE_ACTION_ROLES[accion] ?? [])];
/** ¿Este rol de organización puede hacer lo que pide el paso? */
export const rolTieneCapacidad = (rol, accion) => rolesConCapacidad(accion).includes(rol);
/** Claves i18n que usa una pista (nombre, pasos). */
export const clavesDePista = (pista) => [`onb.${pista}.nombre`, ...pasosDe(pista).flatMap((p) => [p.textos.titulo, p.textos.cuerpo])];
export const CLAVES_UI = Object.freeze(['onb.ui.guia', 'onb.ui.omitir', 'onb.ui.siguiente', 'onb.ui.anterior', 'onb.ui.terminar', 'onb.ui.paso', 'onb.ui.reabrir', 'onb.ui.esperando', 'onb.ui.sinPasos', 'onb.ui.superadminSinOrg', 'onb.ui.cerrar','onb.ui.empezar','onb.ui.saltar','onb.ui.retomar','onb.ui.noVolver','onb.ui.invitacionTitulo','onb.ui.invitacionCuerpo','onb.ui.recorrido','onb.ui.menuGuia','onb.ui.rolOrg','onb.ui.mostrarChecklist','onb.ui.avisoPasos','onb.check.titulo','onb.check.progreso','onb.check.siguiente','onb.check.masTareas','onb.check.ocultar','onb.check.cargando','onb.check.noDisponible','onb.check.abrir','onb.check.estado.hecho','onb.check.estado.salvedad','onb.check.estado.esperando','onb.check.estado.bloqueado','onb.check.estado.pendiente','onb.check.estado.informativo','onb.check.concil','onb.check.bloq.sinDatos','onb.check.bloq.sinIntervencion','onb.tercero.crm','onb.tercero.correo','onb.tercero.propietario']);

const hrefsDelMenu = (menu) => new Set(menu.flatMap((e) => (e.tipo === 'grupo' ? e.items : [e]).flatMap((i) => [i.href, ...(i.alias ?? [])])));
/**
 * Problemas de un paso para su pista: capacidad que el rol no tiene, href que el menú del rol no muestra, soporte con acciones o enlaces, plataforma fuera de /platform.
 * `menuVisible` se inyecta (lib/workspace/menu.mjs) para que este módulo no dependa de él. Lista vacía = paso válido.
 */
export function problemasDePaso(p, menuVisible) {
  const problemas = [];
  if (!ACCIONES.includes(p.accion)) problemas.push(`acción desconocida: ${p.accion}`);
  const rol = ROL_DE_PISTA[p.pista];
  if (rol) {
    if (!rolTieneCapacidad(rol, p.accion)) problemas.push(`${rol} no tiene la capacidad ${p.accion}`);
    if (!p.href || !hrefsDelMenu(menuVisible({ role: rol })).has(p.href)) problemas.push(`el menú de ${rol} no muestra ${p.href}`);
  } else if (p.pista === 'plataforma') {
    if (!p.href || !(p.href === '/platform' || p.href.startsWith('/platform/'))) problemas.push('plataforma solo enlaza a /platform');
  } else if (p.pista === 'soporte') {
    if (ACCIONES_DE_ESCRITURA.includes(p.accion)) problemas.push('soporte no puede tener pasos de escritura');
    if (p.href) problemas.push('soporte no enlaza a nada');
    if (p.prerrequisito) problemas.push('soporte no consulta prerrequisitos');
  }
  return problemas;
}
