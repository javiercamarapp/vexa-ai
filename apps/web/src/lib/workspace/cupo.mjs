// Cupo de lecturas del cliente. Una pantalla de la QA del 23-oct pedía ~12 lecturas a la vez al mismo servidor, que atiende con un pool de 5 conexiones por instancia:
// las lentas (citas, causalidad, brief) dejaban sin turno a las ligeras y caían en 503. Aquí:
//  - a lo sumo TOPE_LECTURAS peticiones /api en vuelo desde esta pestaña (el resto espera en cola, con prioridad: las de la persona antes que el precalentamiento);
//  - el precalentamiento (prioridad baja) solo arranca si NINGUNA lectura de la persona está en vuelo o en cola, y nunca más de TOPE_PRECALENTAMIENTO a la vez;
//  - una lectura GET que recibe 503 se repite en silencio con retroceso (1.2 s, 2.4 s + jitter, respetando Retry-After) antes de mostrarse como error.
export const TOPE_LECTURAS = 4;
export const TOPE_PRECALENTAMIENTO = 2;
export const REINTENTOS_503 = 2;
const abortar = () => new DOMException('Aborted', 'AbortError');

/** Limitador con prioridades. `ejecutar(fn,{baja,signal})` corre fn cuando hay cupo; devuelve lo que devuelva fn. */
export function crearLimitador({tope = TOPE_LECTURAS, topeBaja = TOPE_PRECALENTAMIENTO} = {}) {
  let altas = 0, bajas = 0, pico = 0;
  const colaAlta = [], colaBaja = [];
  const puede = baja => altas + bajas < tope && (!baja || (altas === 0 && colaAlta.length === 0 && bajas < topeBaja));
  function bombear() {
    for (;;) {
      const sig = colaAlta.length && puede(false) ? colaAlta.shift() : colaBaja.length && puede(true) ? colaBaja.shift() : null;
      if (!sig) return;
      sig.arrancar();
    }
  }
  function ejecutar(fn, {baja = false, signal} = {}) {
    if (signal?.aborted) return Promise.reject(abortar());
    return new Promise((res, rej) => {
      const cola = baja ? colaBaja : colaAlta;
      const item = {
        arrancar() {
          signal?.removeEventListener('abort', alAbortar);
          if (baja) bajas++; else altas++;
          pico = Math.max(pico, altas + bajas);
          Promise.resolve().then(fn).then(res, rej).finally(() => { if (baja) bajas--; else altas--; bombear(); });
        },
      };
      const alAbortar = () => { const i = cola.indexOf(item); if (i >= 0) { cola.splice(i, 1); rej(abortar()); bombear(); } };
      signal?.addEventListener('abort', alAbortar, {once: true});
      cola.push(item); bombear();
    });
  }
  return {ejecutar, estado: () => ({altas, bajas, enCola: colaAlta.length + colaBaja.length, pico}), reiniciarPico: () => { pico = altas + bajas; }};
}

export const limitadorGlobal = crearLimitador();
const dormir = (ms, signal) => new Promise((res, rej) => {
  if (signal?.aborted) return rej(abortar());
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(abortar()); }, {once: true});
});
/** Espera antes del reintento n (1, 2…): 1.2 s, 2.4 s, más hasta 25 % de jitter; Retry-After (segundos) manda si es mayor, con tope de 8 s. */
export function esperaReintento(n, retryAfter = null, azar = Math.random) {
  const base = 1200 * 2 ** (n - 1) * (1 + 0.25 * azar()), ra = Number(retryAfter);
  return Math.min(8000, Math.max(base, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 0));
}
/**
 * fetch con cupo. GET (o sin método): ante 503 reintenta hasta REINTENTOS_503 veces con retroceso, salvo precalentamiento (`baja`), que no reintenta.
 * Cualquier otro método pasa por el cupo pero NO se repite (podría escribir dos veces).
 */
export async function fetchCupo(url, init = {}, {baja = false, fetchFn = globalThis.fetch, limitador = limitadorGlobal, espera = esperaReintento, reintentos = REINTENTOS_503} = {}) {
  const metodo = String(init.method ?? 'GET').toUpperCase(), repetible = metodo === 'GET' && !baja;
  for (let intento = 0; ; intento++) {
    const r = await limitador.ejecutar(() => fetchFn(url, init), {baja, signal: init.signal});
    if (r.status !== 503 || !repetible || intento >= reintentos) return r;
    await dormir(espera(intento + 1, r.headers?.get?.('retry-after') ?? null), init.signal);
  }
}
