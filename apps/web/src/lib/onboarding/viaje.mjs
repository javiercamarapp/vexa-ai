// Viaje automático de un paso «ir» del recorrido: lógica pura, sin DOM, sin React y sin red. La UI (guia.tsx / contexto.tsx) solo la conduce.
// Reglas (decisión tomada tras un debate de 3 agentes: se conserva el viaje automático, pero nadie queda varado ni sorprendido):
//  - Solo viaja un paso «ir» al que se llegó AVANZANDO por una acción de la persona (Siguiente, flecha derecha, Empezar, Retomar, elegir pantalla).
//    Anterior, cerrar y un recorrido restaurado tras recargar nunca viajan solos.
//  - Cuenta regresiva visible de CUENTA_MS (nunca menos de MINIMO_MS, exista o no el elemento en el menú).
//  - Se cancela con «Quedarme aquí», Tab, clic fuera de la tarjeta o cualquier interacción con un campo; Esc cierra la guía (y con ella la cuenta).
//  - No viaja con movimiento reducido, ni con el foco en un campo, ni con un formulario modificado en la pantalla: queda el botón manual «Ir a …».
//  - El viaje se dispara UNA sola vez (Siguiente + temporizador no avanzan dos pasos).
//  - Si tras viajar no llega la ruta en FALLO_MS, el paso sale por «No pude abrir esta pantalla» + «Continuar» en vez de quedarse mudo.

/** Cuenta regresiva visible antes de viajar. */
export const CUENTA_MS = 3000;
/** Lo mínimo que se espera antes de viajar solo, también cuando el elemento no existe (menú plegado o cajón móvil). */
export const MINIMO_MS = 1600;
/** Tiempo para que llegue la ruta tras el clic o el push; pasado, el paso sale por fallo. */
export const FALLO_MS = 3000;
/** Paso de la cuenta (ms). */
export const TICK_MS = 1000;

/** Orígenes de un cambio de paso. Solo los que nacen de avanzar por voluntad de la persona arman el viaje. */
const ARMAN = new Set(['siguiente', 'abrir']);
/** ¿Un paso alcanzado por este origen puede viajar solo? Anterior, cerrar, ruta y restaurar (recarga) nunca. */
export function armadoTras(origen) {
  return ARMAN.has(origen);
}

/**
 * Decide si un paso «ir» viaja solo.
 * @param {{tipo?:string, armado:boolean, elemento:'buscando'|'existe'|'ausente', movimientoReducido?:boolean, focoEnCampo?:boolean, formularioSucio?:boolean}} e
 * @returns {{armar:boolean, ms:number, manual:boolean, motivo:'no-ir'|'no-armado'|'buscando'|'movimiento-reducido'|'campo'|'formulario'|'ok'}}
 *  armar = empezar la cuenta; manual = mostrar el botón «Ir a …» (la persona decide cuándo); ninguno = solo el texto de «haz clic o pulsa Siguiente».
 */
export function planearViaje(e) {
  const ms = Math.max(CUENTA_MS, MINIMO_MS);
  if (e.tipo && e.tipo !== 'ir') return { armar: false, ms: 0, manual: false, motivo: 'no-ir' };
  if (!e.armado) return { armar: false, ms: 0, manual: false, motivo: 'no-armado' };
  if (e.elemento === 'buscando') return { armar: false, ms: 0, manual: false, motivo: 'buscando' };
  if (e.movimientoReducido) return { armar: false, ms: 0, manual: true, motivo: 'movimiento-reducido' };
  if (e.focoEnCampo) return { armar: false, ms: 0, manual: true, motivo: 'campo' };
  if (e.formularioSucio) return { armar: false, ms: 0, manual: true, motivo: 'formulario' };
  return { armar: true, ms, manual: false, motivo: 'ok' };
}

/** Motivos por los que la persona cancela la cuenta. */
export const MOTIVOS_CANCELACION = Object.freeze(['quedarme', 'tab', 'clic-fuera', 'campo']);

/**
 * Fases del viaje de un paso «ir»:
 *  inactivo (aún no se decide) · cuenta (cuenta regresiva) · manual (la persona decide con «Ir a …») · viajando (clic/push hecho, esperando la ruta) · fallo (no llegó la ruta) · hecho.
 * @typedef {{fase:'inactivo'|'cuenta'|'manual'|'viajando'|'fallo'|'hecho', restan:number, motivo:string|null}} EstadoViaje
 */
/** @returns {EstadoViaje} */
export const estadoViajeInicial = () => ({ fase: 'inactivo', restan: 0, motivo: null });

/**
 * Transición pura. Devuelve el estado siguiente y, si toca, un efecto: 'viajar' (hacer el clic o el push), exactamente una vez por paso.
 * @param {EstadoViaje} estado
 * @param {{tipo:'planear', plan:ReturnType<typeof planearViaje>}|{tipo:'tick'}|{tipo:'cancelar', motivo:string}|{tipo:'siguiente'|'manual'|'clic'|'ruta'|'plazo'|'reiniciar'}} evento
 * @returns {{estado:EstadoViaje, efecto:'viajar'|null}}
 */
export function reducirViaje(estado, evento) {
  const igual = { estado, efecto: null };
  switch (evento.tipo) {
    case 'planear': {
      // Solo se planea una vez por paso, antes de que haya pasado nada.
      if (estado.fase !== 'inactivo') return igual;
      const p = evento.plan;
      if (p.armar) return { estado: { fase: 'cuenta', restan: Math.ceil(p.ms / TICK_MS), motivo: null }, efecto: null };
      if (p.manual) return { estado: { fase: 'manual', restan: 0, motivo: p.motivo }, efecto: null };
      return igual;
    }
    case 'tick': {
      if (estado.fase !== 'cuenta') return igual;
      const restan = estado.restan - 1;
      if (restan <= 0) return { estado: { fase: 'viajando', restan: 0, motivo: null }, efecto: 'viajar' };
      return { estado: { ...estado, restan }, efecto: null };
    }
    case 'cancelar':
      // Solo se puede cancelar una cuenta en marcha; ya viajando no hay vuelta atrás.
      return estado.fase === 'cuenta' ? { estado: { fase: 'manual', restan: 0, motivo: evento.motivo }, efecto: null } : igual;
    case 'siguiente':
    case 'manual':
      // Siguiente, flecha derecha o «Ir a …». Si ya se viaja (o ya llegó) no se dispara otra vez: así Siguiente + temporizador son un solo viaje.
      if (estado.fase === 'viajando' || estado.fase === 'hecho' || estado.fase === 'fallo') return igual;
      return { estado: { fase: 'viajando', restan: 0, motivo: null }, efecto: 'viajar' };
    case 'clic':
      // La persona hizo clic ella misma en el elemento señalado: no hay nada que disparar, solo esperar la ruta.
      if (estado.fase === 'viajando' || estado.fase === 'hecho') return igual;
      return { estado: { fase: 'viajando', restan: 0, motivo: null }, efecto: null };
    case 'ruta':
      return estado.fase === 'hecho' ? igual : { estado: { fase: 'hecho', restan: 0, motivo: null }, efecto: null };
    case 'plazo':
      return estado.fase === 'viajando' ? { estado: { fase: 'fallo', restan: 0, motivo: 'sin-ruta' }, efecto: null } : igual;
    case 'reiniciar':
      return { estado: estadoViajeInicial(), efecto: null };
    default:
      return igual;
  }
}

/**
 * Conductor con temporizadores: une `reducirViaje` con la cuenta (un temporizador por segundo) y el plazo de fallo.
 * `programar`/`cancelar` se inyectan (por defecto los globales, leídos en cada llamada para que valgan temporizadores simulados).
 * @param {{alCambiar?:(e:EstadoViaje)=>void, alViajar?:()=>void, programar?:(f:()=>void, ms:number)=>unknown, cancelar?:(id:unknown)=>void}} [deps]
 */
export function crearViaje(deps = {}) {
  const programar = deps.programar ?? ((f, ms) => globalThis.setTimeout(f, ms));
  const cancelar = deps.cancelar ?? ((id) => globalThis.clearTimeout(id));
  let estado = estadoViajeInicial();
  let cuenta = null;
  let plazo = null;
  const limpiar = () => {
    if (cuenta != null) cancelar(cuenta);
    if (plazo != null) cancelar(plazo);
    cuenta = plazo = null;
  };
  const enviar = (evento) => {
    const antes = estado;
    const r = reducirViaje(estado, evento);
    estado = r.estado;
    if (estado.fase !== antes.fase || estado.restan !== antes.restan) {
      limpiar();
      if (estado.fase === 'cuenta') cuenta = programar(() => { cuenta = null; enviar({ tipo: 'tick' }); }, TICK_MS);
      if (estado.fase === 'viajando') plazo = programar(() => { plazo = null; enviar({ tipo: 'plazo' }); }, FALLO_MS);
      deps.alCambiar?.(estado);
    }
    if (r.efecto === 'viajar') deps.alViajar?.();
    return estado;
  };
  return {
    enviar,
    estado: () => estado,
    /** Termina el paso (cerrar, Anterior, otro paso): nada queda programado. */
    reiniciar: () => enviar({ tipo: 'reiniciar' }),
    destruir: () => { limpiar(); estado = estadoViajeInicial(); },
  };
}
