// «Datos vivos» en el navegador: consulta una marca ligera (GET /api/freshness -> data.version) cada N s, con retroceso exponencial si falla, SOLO con la pestaña visible,
// y avisa cuando la versión cambió (hay datos nuevos). No descarga datos: la revalidación real la hace la caché SWR (swr.mjs) cuando el usuario actualiza o en modo automático.
//  - el primer valor leído es la línea base (no avisa); `primerRetrasoMs` difiere ese primer sondeo para que NO compita con las lecturas de la primera pantalla (A6, auditoría 24-oct);
//  - 401/403/404 detienen la vigilancia (sin acceso o sin servicio: no se insiste); errores de red/5xx reintentan con retroceso (×2 hasta maxMs) y NO avisan;
//  - al volver a ser visible se consulta enseguida si ya pasó el intervalo; los temporizadores se cancelan al ocultarse;
//  - `reconocer()` fija la línea base en la última versión vista (tras actualizar).
export const INTERVALO_MS = 30_000;
export const MAX_RETROCESO_MS = 5 * 60_000;
export const ENDPOINT = '/api/freshness';
const esVersion = v => typeof v === 'string' && /^[a-f0-9]{8,64}$/.test(v);
export function crearVigilante({fetchFn = globalThis.fetch, visible = () => true, onCambio = () => {}, onEstado = () => {}, intervaloMs = INTERVALO_MS, maxMs = MAX_RETROCESO_MS,
  ahora = Date.now, setT = globalThis.setTimeout, clearT = globalThis.clearTimeout, endpoint = ENDPOINT, primerRetrasoMs = 0} = {}) {
  let base = null, ultima = null, espera = intervaloMs, timer = null, activo = false, parado = false, enVuelo = false, ultimoIntento = 0, fallos = 0, hayNuevos = false;
  const programar = ms => { clearT(timer); timer = null; if (!activo || parado || !visible()) return; timer = setT(() => { timer = null; void consultar(); }, ms); };
  async function consultar() {
    if (!activo || parado || enVuelo || !visible()) return;
    enVuelo = true; ultimoIntento = ahora();
    try {
      const r = await fetchFn(endpoint, {cache: 'no-store', priority: 'low'});
      if ([401, 403, 404].includes(r.status)) { parado = true; onEstado({estado: 'detenido', status: r.status}); return; }
      if (!r.ok) throw new Error('status ' + r.status);
      const j = await r.json().catch(() => null), d = j?.data;
      if (!d || d.availability !== 'ready' || !esVersion(d.version)) { fallos = 0; espera = intervaloMs; onEstado({estado: 'sin_datos'}); return; }
      fallos = 0; espera = intervaloMs; ultima = d.version;
      if (base === null) base = d.version;
      else if (d.version !== base && !hayNuevos) { hayNuevos = true; onCambio({version: d.version, anterior: base, fuentes: d.sources ?? [], insights: d.insights ?? []}); }
      onEstado({estado: 'vigilando', version: d.version});
    } catch { fallos++; espera = Math.min(maxMs, intervaloMs * 2 ** fallos); onEstado({estado: 'reintentando', espera, fallos}); }
    finally { enVuelo = false; programar(espera); }
  }
  return {
    iniciar() { if (activo) return; activo = true; parado = false; if (primerRetrasoMs > 0) programar(primerRetrasoMs); else void consultar(); },
    detener() { activo = false; clearT(timer); timer = null; },
    /** Llamar al cambiar la visibilidad de la pestaña. */
    visibilidad() { if (!activo || parado) return; if (!visible()) { clearT(timer); timer = null; return; } if (ahora() - ultimoIntento >= intervaloMs) void consultar(); else programar(Math.max(0, intervaloMs - (ahora() - ultimoIntento))); },
    reconocer() { base = ultima ?? base; hayNuevos = false; },
    estado: () => ({base, ultima, espera, fallos, parado, hayNuevos, activo}),
  };
}
