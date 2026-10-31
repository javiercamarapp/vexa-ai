// Máquina de estados del recorrido (tour): pura, sin DOM ni red. La UI (components/onboarding) solo la conduce.
// Reglas de accesibilidad que codifica:
//  - El recorrido SOLO se abre con un evento 'abrir' (una persona lo pidió). Un cambio de ruta ('ruta') jamás lo abre ni lo cierra; solo completa un paso «ir» cuando llegas a la pantalla a la que te mandaba.
//  - Esc cierra y conserva el paso (para «Retomar donde lo dejé»); Terminar al llegar al último paso cierra y marca terminado.
//  - Las flechas izquierda/derecha cambian de paso (también tras navegar) salvo dentro de campos de texto, listas o pestañas; Enter avanza SOLO si el foco no está en un control que ya reacciona a Enter.

import { enPantalla } from './ruta.mjs';

/** @typedef {{abierto:boolean, indice:number, terminado:boolean, iniciadoPorPersona:boolean}} EstadoRecorrido */
/** @returns {EstadoRecorrido} */
export const estadoInicial = () => ({ abierto: false, indice: 0, terminado: false, iniciadoPorPersona: false });

const acotar = (n, total) => Math.max(0, Math.min(Math.trunc(Number.isFinite(n) ? n : 0), Math.max(0, total - 1)));
const esIr = (p) => p?.tipo === 'ir';
/** No detenerse en un paso «ir» de la pantalla donde ya estamos (no hay nada que apretar). Devuelve -1 si se sale del recorrido. */
function sinIrInutiles(indice, dir, pasos, ruta) {
  let i = indice;
  while (pasos && ruta != null && esIr(pasos[i]) && enPantalla(ruta, pasos[i].href)) i += dir;
  return i;
}

/**
 * @param {EstadoRecorrido} estado
 * @param {{tipo:'abrir'|'ir',indice?:number}|{tipo:'ruta',ruta?:string}|{tipo:'siguiente'|'anterior'|'cerrar'|'clic'}} evento
 * @param {number} total pasos del tour de la pista (0 = no hay tour)
 * @param {ReadonlyArray<{tipo:string,href:string|null}>} [pasos] pasos del tour (con ellos: el clic en el objetivo y la llegada a la pantalla avanzan un paso «ir»)
 * @param {string|null} [ruta] ruta actual (permite no detenerse en un paso «ir» de la pantalla donde ya estamos)
 * @returns {EstadoRecorrido}
 */
export function reducir(estado, evento, total, pasos, ruta = null) {
  if (total <= 0) return estadoInicial();
  const avanzar = () => {
    if (!estado.abierto) return estado;
    if (estado.indice >= total - 1) return { ...estado, abierto: false, terminado: true };
    const i = sinIrInutiles(estado.indice + 1, 1, pasos, ruta);
    return i >= total ? { ...estado, abierto: false, terminado: true } : { ...estado, indice: i };
  };
  switch (evento.tipo) {
    case 'abrir':
    case 'ir': {
      if (evento.tipo === 'ir' && !estado.abierto) return estado;
      const i = sinIrInutiles(acotar(evento.indice ?? 0, total), 1, pasos, ruta);
      return { abierto: true, indice: Math.min(i, total - 1), terminado: false, iniciadoPorPersona: true };
    }
    case 'siguiente': return avanzar();
    case 'anterior': {
      if (!estado.abierto) return estado;
      // Hacia atrás un paso «ir» nunca es destino: ya se viajó (o no se pudo) y volver a él solo re-dispararía el viaje.
      let i = acotar(estado.indice - 1, total);
      while (i >= 0 && esIr(pasos?.[i])) i--;
      return { ...estado, indice: i < 0 ? estado.indice : i };
    }
    case 'cerrar': return estado.abierto ? { ...estado, abierto: false, terminado: false } : estado;
    // El clic en el objetivo del paso «ir» (o «Llévame») lo completa; un clic en otro paso no hace nada.
    case 'clic': return estado.abierto && esIr(pasos?.[estado.indice]) ? avanzar() : estado;
    // Llegar a la pantalla del paso «ir» (por clic, «Llévame» o como sea) lo completa. Cualquier otro cambio de ruta no abre, cierra ni mueve el recorrido.
    case 'ruta': {
      const actual = pasos?.[estado.indice];
      return estado.abierto && esIr(actual) && enPantalla(evento.ruta ?? '', actual.href) ? avanzar() : estado;
    }
    default: return estado;
  }
}

const ENTER_PROPIO = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);
const ROLES_PROPIOS = new Set(['textbox', 'searchbox', 'combobox', 'listbox', 'option', 'slider', 'spinbutton', 'radio', 'radiogroup', 'tab', 'tablist', 'menu', 'menubar', 'menuitem', 'tree', 'treeitem', 'grid', 'gridcell']);
/** ¿El elemento usa las flechas/teclas para lo suyo (campos de texto, listas, pestañas…)? Entonces el recorrido no se las quita. */
export function teclasPropias(el) {
  if (!el) return false;
  const tag = String(el.tagName ?? '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true) return true;
  const rol = typeof el.getAttribute === 'function' ? el.getAttribute('role') : null;
  return rol != null && ROLES_PROPIOS.has(rol);
}
/**
 * Evento que corresponde a una tecla pulsada, o null. `etiquetaObjetivo` = tagName del elemento con el foco.
 * Esc siempre sale. Con `propias` (campo de texto, lista, pestañas…) o con modificadores (Alt+←, Ctrl+→…) no se roba ninguna otra tecla.
 */
export function eventoDeTecla(key, etiquetaObjetivo = '', { propias = false, modificador = false } = {}) {
  if (key === 'Escape') return { tipo: 'cerrar' };
  if (propias || modificador) return null;
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
