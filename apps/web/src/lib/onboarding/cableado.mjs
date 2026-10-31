// Cableado del viaje automático entre el recorrido y el navegador: las DECISIONES (qué evento arma el viaje, qué tecla lo cancela, quién recibe «Siguiente»,
// cuándo se puede mover el foco) viven aquí como funciones puras, sin React ni DOM real, para poder probarlas con temporizadores simulados.
// contexto.tsx y guia.tsx solo las conectan a los hooks y a los eventos del documento; tests/onboarding-cableado.test.tsx ata ambos lados.
import { armadoTras, planearViaje } from './viaje.mjs';
import { eventoDeTecla } from './recorrido.mjs';

/**
 * Memoria de «¿el paso actual se alcanzó AVANZANDO por voluntad de la persona?». Cada cambio del recorrido la reescribe con su origen:
 * solo 'siguiente' y 'abrir' arman; Anterior, cerrar, un cambio de ruta y un recorrido restaurado tras recargar la dejan en falso.
 */
export function crearArmado() {
  let armado = false;
  return {
    /** Registra el origen del cambio de paso y devuelve si quedó armado. */
    tras(origen) {
      armado = armadoTras(origen);
      return armado;
    },
    esta: () => armado,
  };
}

/**
 * Decisión de viaje de un paso «ir» ya con su elemento resuelto (`el` = el elemento del menú, o null si no existe: menú plegado o cajón móvil).
 * Los sensores se leen AL DECIDIR (no antes): movimiento reducido, foco en un campo y formulario modificado impiden viajar solo.
 * @param {{tipo:string, armado:boolean, el:unknown, sensores:{reducirMovimiento:()=>boolean, enCampo:()=>boolean, hayFormularioSucio:()=>boolean}}} e
 */
export function planDelPaso({ tipo, armado, el, sensores }) {
  return planearViaje({
    tipo,
    armado,
    elemento: el ? 'existe' : 'ausente',
    movimientoReducido: sensores.reducirMovimiento(),
    focoEnCampo: sensores.enCampo(),
    formularioSucio: sensores.hayFormularioSucio(),
  });
}

/**
 * Qué hace «Siguiente» (botón, flecha derecha, Enter en la tarjeta).
 *  - Paso «ir» con conductor: pasa por el conductor, así Siguiente + temporizador son UN solo viaje. Pero si el viaje ya falló («No pude abrir esta pantalla»),
 *    Siguiente hace lo mismo que «Continuar»: avanza el recorrido (si no, la flecha derecha no haría nada).
 *  - Paso «ir» sin conductor (aún no montado): lleva directo.
 *  - Cualquier otro paso: avanza el recorrido.
 * @returns {'conductor'|'continuar'|'llevar'|'avanzar'}
 */
export function siguienteDelPaso({ tipo, conductor, despachar, llevar }) {
  if (tipo !== 'ir') {
    despachar({ tipo: 'siguiente' });
    return 'avanzar';
  }
  if (!conductor) {
    llevar();
    return 'llevar';
  }
  if (conductor.estado().fase === 'fallo') {
    despachar({ tipo: 'siguiente' });
    return 'continuar';
  }
  conductor.enviar({ tipo: 'siguiente' });
  return 'conductor';
}

/**
 * Teclas que cancelan la cuenta regresiva. Tab la cancela y sigue su curso. Escape SOLO cancela el viaje y se «consume» (preventDefault) para que el
 * teclado del recorrido no cierre la guía; con la cuenta ya cancelada, el segundo Escape llega al recorrido y la cierra.
 * @returns {{motivo:'tab'|'escape', consumir:boolean}|null}
 */
export function teclaQueCancela(key) {
  if (key === 'Tab') return { motivo: 'tab', consumir: false };
  if (key === 'Escape') return { motivo: 'escape', consumir: true };
  return null;
}

/** Aplica una tecla a la cuenta en marcha: cancela el viaje y, si toca, consume el evento. Devuelve si cancelaba. */
export function cancelarConTecla(conductor, evento) {
  const r = teclaQueCancela(evento.key);
  if (!r) return false;
  conductor.enviar({ tipo: 'cancelar', motivo: r.motivo });
  if (r.consumir) evento.preventDefault();
  return true;
}

/** Un clic o toque FUERA de la tarjeta cancela la cuenta; dentro de ella (sus botones) no. */
export const punteroFueraDeTarjeta = (objetivo, tarjeta) => !(objetivo && tarjeta && typeof tarjeta.contains === 'function' && tarjeta.contains(objetivo));

/**
 * ¿Se le puede mover el foco a la persona? Sí si no está en ningún sitio, está en la tarjeta, en el menú de la guía o en el botón «Guía»; no si está
 * en la página (un campo, un enlace): ahí no se le quita.
 * @param {{activo:any, cuerpo?:any, tarjeta?:any, menu?:any}} e
 */
export function puedeTomarFoco({ activo, cuerpo, tarjeta, menu }) {
  if (!activo || activo === cuerpo) return true;
  if (tarjeta?.contains?.(activo) || menu?.contains?.(activo)) return true;
  return activo.id === 'onb-boton';
}

/** Limpieza al cambiar de paso o cerrar: nada del viaje anterior queda vivo (ni la cuenta ni el plazo). Devuelve la función de limpieza del efecto; el conductor se lee al limpiar (`obtener`), no al montar. */
export const reiniciarAlSalir = (obtener) => () => {
  obtener()?.reiniciar();
};

/**
 * Evento del recorrido que corresponde a una tecla del documento, o null. Un evento que ya fue consumido (`defaultPrevented`) no hace nada: así el Escape que acaba de
 * cancelar la cuenta NO cierra la guía, y el siguiente Escape sí. Enter solo cuenta dentro de la tarjeta.
 * @param {{key:string, defaultPrevented:boolean, tagName:string, dentroDeTarjeta:boolean, propias:boolean, modificador:boolean}} e
 */
export function eventoDeTeclado({ key, defaultPrevented, tagName, dentroDeTarjeta, propias, modificador }) {
  if (defaultPrevented) return null;
  const ev = eventoDeTecla(key, tagName, { propias, modificador });
  if (!ev) return null;
  if (key === 'Enter' && !dentroDeTarjeta) return null;
  return ev;
}
