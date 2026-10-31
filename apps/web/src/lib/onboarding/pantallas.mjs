// Contenido del recorrido por pantalla (F2b): ilustración, elemento clave y acción principal de cada pantalla del producto.
// NO es una lista paralela de pasos por rol: qué pantallas recorre cada pista lo decide tour.mjs desde el menú real (menuVisible) y el catálogo.
// Aquí solo vive lo que no depende del rol: a qué elemento apuntar (selectores) y qué claves i18n lleva cada pantalla (onb.pant.<slug>.*).
// Sin imports: lo usa catalogo.mjs (claves) y tour.mjs (construcción).

/** Slug de una ruta para las claves i18n: «/settings/team» → «settings-team». */
export const slugDe = (href) => href.replace(/^\//, '').replace(/\//g, '-');

const CONT = '#workspace-contenido';
/** Qué es la pantalla: su título. */
const QUE = Object.freeze([`${CONT} .page-header h1`, `${CONT} h1`, `${CONT} h2`]);
/** Acción principal genérica: la barra de acciones del encabezado o el primer botón de envío. */
const ACCIONES = Object.freeze([`${CONT} .page-header-actions`, `${CONT} form button[type="submit"]`, `${CONT} button`]);
const TABLA = Object.freeze([`${CONT} table`, `${CONT} [role="tablist"]`, `${CONT} .task-card`, `${CONT} section`, `${CONT} form`]);

/**
 * ilu = ilustración (components/onboarding/ilustraciones.tsx). que/clave/accion = selectores del elemento real (el primero visible gana; si no hay ninguno la tarjeta queda centrada).
 * accion.capacidad = acción del servidor que el rol debe tener para que ese paso exista (derivado de db.ts, nunca copiado).
 */
export const PANTALLAS = Object.freeze({
  '/overview': { ilu: 'barras', clave: ['[data-tour="hoy-cifras"]', '[data-tour="mis-intervenciones"]', '[data-tour="hoy-rol"]', ...TABLA] },
  '/preguntale': { ilu: 'chat', clave: [`${CONT} textarea`, `${CONT} input[type="text"]`, `${CONT} form`, ...TABLA] },
  '/cfo': { ilu: 'linea', clave: TABLA },
  '/gaps': { ilu: 'linea', clave: TABLA },
  '/refunds': { ilu: 'linea', clave: TABLA },
  '/problems': { ilu: 'barras', clave: ['[data-tour="problemas"]', ...TABLA], accion: { capacidad: 'read', objetivos: [`${CONT} table a`, `${CONT} [data-tour="problemas"] a`, ...ACCIONES] } },
  '/pain-points': { ilu: 'equipo', clave: TABLA },
  '/cco': { ilu: 'tarjetas', clave: [`${CONT} .cco-card`, ...TABLA] },
  '/map': { ilu: 'mapa', clave: [`${CONT} svg`, `${CONT} canvas`, ...TABLA] },
  '/workload': { ilu: 'linea', clave: TABLA },
  '/recommendations': { ilu: 'tarjetas', clave: TABLA, accion: { capacidad: 'approve', objetivos: ACCIONES } },
  '/interventions': { ilu: 'tarjetas', clave: TABLA, accion: { capacidad: 'execute', objetivos: ACCIONES } },
  '/confianza': { ilu: 'escudo', clave: TABLA },
  '/sources': { ilu: 'nodos', clave: TABLA },
  '/connections': { ilu: 'nodos', clave: ['[data-tour="fuentes"]', ...TABLA], accion: { capacidad: 'configure', objetivos: ACCIONES } },
  '/imports': { ilu: 'importar', clave: TABLA, accion: { capacidad: 'import', objetivos: ACCIONES } },
  '/history': { ilu: 'importar', clave: TABLA },
  '/analysis': { ilu: 'chat', clave: TABLA },
  '/economics': { ilu: 'corte', clave: TABLA },
  '/explorer': { ilu: 'corte', clave: [`${CONT} table`, `${CONT} form`, ...TABLA] },
  '/settings/notifications': { ilu: 'campana', clave: [`${CONT} form`, ...TABLA], accion: { capacidad: 'notify', objetivos: [`${CONT} input[type="checkbox"]`, ...ACCIONES] } },
  '/setup': { ilu: 'lista', clave: ['[data-tour="setup"] ol', '[data-tour="setup"]', ...TABLA] },
  '/settings/team': { ilu: 'equipo', clave: TABLA, accion: { capacidad: 'configure', objetivos: ACCIONES } },
  '/settings/notification-delivery': { ilu: 'campana', clave: [`${CONT} form`, ...TABLA] },
  '/settings/retention': { ilu: 'escudo', clave: [`${CONT} form`, ...TABLA] },
  // Consola de plataforma (pista «plataforma»; no pasa por el menú del cliente).
  '/platform': { ilu: 'panel', clave: TABLA },
  '/platform/organizaciones': { ilu: 'nodos', clave: TABLA },
  '/platform/costos-ia': { ilu: 'linea', clave: TABLA },
  '/platform/auditoria': { ilu: 'lista', clave: TABLA },
});
export { QUE, ACCIONES };

/**
 * Textos de pantalla que cambian según la pista: la clave `<slug>.<campo>` (campo = desc, claveT, claveC, accionT, accionC) apunta, por pista, a otra clave i18n.
 * Se usan cuando el texto general promete algo que ese rol no hace (decidir, mirar periodos y conciliación de dinero, «lo que hiciste»).
 */
export const TEXTO_PISTA = Object.freeze({
  'overview.claveC': Object.freeze({ operador: 'onb.pant.overview.claveC.operador', lector: 'onb.pant.overview.claveC.lector' }),
  'recommendations.desc': Object.freeze({ analista: 'onb.pant.recommendations.desc.sinAprobar', operador: 'onb.pant.recommendations.desc.sinAprobar', lector: 'onb.pant.recommendations.desc.sinAprobar' }),
  'recommendations.claveT': Object.freeze({ analista: 'onb.pant.recommendations.claveT.sinAprobar', operador: 'onb.pant.recommendations.claveT.sinAprobar', lector: 'onb.pant.recommendations.claveT.sinAprobar' }),
  'interventions.desc': Object.freeze({ analista: 'onb.pant.interventions.desc.general', lector: 'onb.pant.interventions.desc.general' }),
  'interventions.accionC': Object.freeze({ propietario: 'onb.pant.interventions.accionC.propietario' }),
});
/** Texto (clave i18n) de un campo de una pantalla para una pista: el propio de la pista si lo hay; si no, el general. */
export const textoDe = (pista, href, campo, general) => TEXTO_PISTA[`${slugDe(href)}.${campo}`]?.[pista] ?? general;
export const CLAVES_TEXTO_PISTA = Object.freeze([...new Set(Object.values(TEXTO_PISTA).flatMap((m) => Object.values(m)))]);

/** Claves i18n que usa una pantalla (la de «accion» solo si la tiene). */
export const clavesDePantalla = (href) => {
  const s = slugDe(href), d = PANTALLAS[href];
  return [`onb.pant.${s}.desc`, `onb.pant.${s}.claveT`, `onb.pant.${s}.claveC`, ...(d.accion ? [`onb.pant.${s}.accionT`, `onb.pant.${s}.accionC`] : [])];
};
export const CLAVES_PANTALLAS = Object.freeze(Object.keys(PANTALLAS).flatMap(clavesDePantalla));
