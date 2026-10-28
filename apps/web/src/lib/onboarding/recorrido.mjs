// Máquina de estados del recorrido (tour): pura, sin DOM ni red. La UI (components/onboarding) solo la conduce.
// Reglas de accesibilidad que codifica:
//  - El recorrido SOLO se abre con un evento 'abrir' (una persona lo pidió). Un cambio de ruta ('ruta') jamás lo abre, lo cierra ni lo mueve.
//  - Esc cierra y conserva el paso (para «Retomar donde lo dejé»); Terminar al llegar al último paso cierra y marca terminado.
//  - Las flechas izquierda/derecha cambian de paso; Enter avanza SOLO si el foco no está en un control que ya reacciona a Enter.

/** @typedef {{abierto:boolean, indice:number, terminado:boolean, iniciadoPorPersona:boolean}} EstadoRecorrido */
/** @returns {EstadoRecorrido} */
export const estadoInicial = () => ({ abierto: false, indice: 0, terminado: false, iniciadoPorPersona: false });

const acotar = (n, total) => Math.max(0, Math.min(Math.trunc(Number.isFinite(n) ? n : 0), Math.max(0, total - 1)));

/**
 * @param {EstadoRecorrido} estado
 * @param {{tipo:'abrir',indice?:number}|{tipo:'siguiente'|'anterior'|'cerrar'|'ruta'}} evento
 * @param {number} total pasos del tour de la pista (0 = no hay tour)
 * @returns {EstadoRecorrido}
 */
export function reducir(estado, evento, total) {
  if (total <= 0) return estadoInicial();
  switch (evento.tipo) {
    case 'abrir': return { abierto: true, indice: acotar(evento.indice ?? 0, total), terminado: false, iniciadoPorPersona: true };
    case 'siguiente':
      if (!estado.abierto) return estado;
      return estado.indice >= total - 1 ? { ...estado, abierto: false, terminado: true } : { ...estado, indice: estado.indice + 1 };
    case 'anterior': return estado.abierto ? { ...estado, indice: acotar(estado.indice - 1, total) } : estado;
    case 'cerrar': return estado.abierto ? { ...estado, abierto: false, terminado: false } : estado;
    case 'ruta': return estado; // cambiar de pantalla nunca abre, cierra ni mueve el recorrido
    default: return estado;
  }
}

const ENTER_PROPIO = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);
/** Evento que corresponde a una tecla pulsada dentro de la tarjeta, o null. `etiquetaObjetivo` = tagName del elemento con el foco. */
export function eventoDeTecla(key, etiquetaObjetivo = '') {
  if (key === 'Escape') return { tipo: 'cerrar' };
  if (key === 'ArrowRight') return { tipo: 'siguiente' };
  if (key === 'ArrowLeft') return { tipo: 'anterior' };
  if (key === 'Enter' && !ENTER_PROPIO.has(String(etiquetaObjetivo).toUpperCase())) return { tipo: 'siguiente' };
  return null;
}

/**
 * Selectores del elemento real que resalta cada paso (el primero visible gana). Si ninguno existe la tarjeta se degrada: sin resaltar y sin fallar.
 * `data-tour` vive en el shell, el menú y las pantallas; el menú usa data-tour="menu:<href>".
 */
export const OBJETIVOS = Object.freeze({
  'propietario.hoy': ['[data-tour="hoy-cifras"]', '[data-tour="alcance"]', '[data-tour="menu:/overview"]'],
  'propietario.datos': ['[data-tour="fuentes"]', '[data-tour="menu:/connections"]', '[data-tour="menu:/imports"]'],
  'propietario.confianza': ['[data-tour="menu:/confianza"]'],
  'propietario.problema': ['[data-tour="problemas"]', '[data-tour="menu:/problems"]'],
  'propietario.acciones': ['[data-tour="menu:/recommendations"]', '[data-tour="menu:/interventions"]'],
  'analista.hoy': ['[data-tour="hoy-cifras"]', '[data-tour="menu:/overview"]'],
  'analista.problemas': ['[data-tour="problemas"]', '[data-tour="menu:/problems"]'],
  'analista.dinero': ['[data-tour="menu:/cfo"]'],
  'analista.importar': ['[data-tour="menu:/imports"]'],
  'analista.preguntar': ['[data-tour="menu:/preguntale"]'],
  'operador.hoy': ['[data-tour="mis-intervenciones"]', '[data-tour="hoy-rol"]', '[data-tour="menu:/overview"]'], // Hoy propio del rol (HoyRol): sin cifras de dinero
  'operador.problemas': ['[data-tour="problemas"]', '[data-tour="menu:/problems"]'],
  'operador.acciones': ['[data-tour="menu:/interventions"]'],
  'operador.preguntar': ['[data-tour="menu:/preguntale"]'],
  'operador.avisos': ['[data-tour="menu:/settings/notifications"]'],
  'lector.hoy': ['[data-tour="hoy-rol"]', '[data-tour="menu:/overview"]'], // Hoy propio del rol (HoyRol): sin cifras de dinero
  'lector.problemas': ['[data-tour="problemas"]', '[data-tour="menu:/problems"]'],
  'lector.confianza': ['[data-tour="menu:/confianza"]'],
  'lector.avisos': ['[data-tour="menu:/settings/notifications"]'],
  'plataforma.resumen': ['[data-tour="plataforma:/platform"]'],
  'plataforma.organizaciones': ['[data-tour="plataforma:/platform/organizaciones"]'],
  'plataforma.costos': ['[data-tour="plataforma:/platform/costos-ia"]'],
  'plataforma.auditoria': ['[data-tour="plataforma:/platform/auditoria"]'],
});
