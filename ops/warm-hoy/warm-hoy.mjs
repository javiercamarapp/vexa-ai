#!/usr/bin/env node
// Calentamiento y diagnóstico de «Hoy» tras un despliegue. SOLO LECTURA (tres GET), sin tocar la base ni cambiar resultados.
//
// «Hoy» pide a la vez /api/refunds, /api/workload y /cfo/data/report. Tras un despliegue cada ruta arranca una función nueva (módulos, conexión al pooler,
// sesión) y su memoria de lecturas está vacía. Esta herramienta hace esas tres peticiones con la sesión de quien la corre:
//   ronda 1 = lo que vería la primera persona después del despliegue (y deja las instancias y la memoria calientes);
//   ronda 2 = el tiempo ya caliente. Además imprime de dónde salió cada cifra (precalculado o en vivo): si dice «en_vivo», el precálculo no estaba vigente.
//
// Uso:  node ops/warm-hoy/warm-hoy.mjs https://app.rovaq.ai [--rondas 2]
//   La sesión se lee de un archivo con el encabezado Cookie completo (una línea): VEXA_WARM_COOKIE_FILE=/ruta/al/archivo (permisos 600).
//   Sin ese archivo solo calienta lo público (/login y /api/health/version) y lo dice. Nunca imprime ni guarda la cookie.
import fs from 'node:fs';

/** Rutas que «Hoy» pide, con la forma de leer de dónde salió la cifra. */
export const RUTAS_HOY = Object.freeze([
  { id: 'reembolsos', ruta: '/api/refunds', origen: (j) => ({ libro: j?.data?.origenLibro ?? null, precalculadoAt: j?.data?.libroPrecalculadoAt ?? null }) },
  { id: 'carga', ruta: '/api/workload', origen: (j) => ({ sla: j?.data?.sla?.origen ?? null, matriz: j?.data?.carga?.origen ?? null }) },
  { id: 'cfo', ruta: '/cfo/data/report', origen: (j) => ({ estado: j?.data?.status ?? null, resumen: j?.data?.summary?.source ?? j?.data?.report?.summary?.source ?? null }) },
]);

export function origenValido(raw) {
  try { const u = new URL(String(raw ?? '')); if (u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1') return u.origin; } catch { /* sin origen válido */ }
  return null;
}
/** Cookie desde archivo: una línea, sin saltos; null si no hay archivo. Nunca se devuelve en mensajes de error. */
export function leerCookie(ruta) {
  if (!ruta) return null;
  const t = fs.readFileSync(ruta, 'utf8').replace(/[\r\n]+/g, '').trim();
  return t || null;
}
/** Una petición cronometrada. Devuelve {id, status, ms, origen}; un fallo de red es status 0 con el motivo, nunca una excepción. */
export async function pedir(origen, def, cookie, { fetchImpl = fetch, ahora = () => performance.now(), tope = 60000 } = {}) {
  const t0 = ahora();
  try {
    const r = await fetchImpl(origen + def.ruta, { headers: { accept: 'application/json', ...(cookie ? { cookie } : {}) }, cache: 'no-store', signal: AbortSignal.timeout(tope) });
    let origenDato = null;
    if (r.ok) { try { origenDato = def.origen(await r.json()); } catch { /* cuerpo no JSON: se informa sin origen */ } }
    return { id: def.id, status: r.status, ms: Math.round(ahora() - t0), origen: origenDato };
  } catch (e) { return { id: def.id, status: 0, ms: Math.round(ahora() - t0), error: e?.name === 'TimeoutError' ? 'tiempo agotado' : 'sin respuesta' }; }
}
/** Las tres juntas, como las pide la pantalla. */
export const ronda = (origen, cookie, opciones) => Promise.all(RUTAS_HOY.map((d) => pedir(origen, d, cookie, opciones)));
export function formatear(numero, resultados) {
  return [`Ronda ${numero}`, ...resultados.map((r) => `  ${r.id.padEnd(10)} ${String(r.status).padStart(3)}  ${String(r.ms).padStart(6)} ms  ${r.error ?? (r.origen ? JSON.stringify(r.origen) : '')}`.trimEnd())].join('\n');
}

async function principal(argv) {
  const origen = origenValido(argv[0]);
  if (!origen) { console.error('Uso: node ops/warm-hoy/warm-hoy.mjs https://app.rovaq.ai [--rondas 2]'); return 2; }
  const i = argv.indexOf('--rondas'), rondas = i >= 0 ? Math.min(Math.max(Number(argv[i + 1]) || 2, 1), 5) : 2;
  const cookie = leerCookie(process.env.VEXA_WARM_COOKIE_FILE);
  if (!cookie) {
    console.log('Sin VEXA_WARM_COOKIE_FILE: solo se calienta lo público (no se toca ningún dato).');
    for (const ruta of ['/login', '/api/health/version']) { const t0 = performance.now(); const r = await fetch(origen + ruta, { cache: 'no-store' }).catch(() => null); console.log(`  ${ruta.padEnd(22)} ${r ? r.status : 0}  ${Math.round(performance.now() - t0)} ms`); }
    return 0;
  }
  let fallo = false;
  for (let n = 1; n <= rondas; n++) {
    const res = await ronda(origen, cookie);
    console.log(formatear(n, res));
    if (res.some((r) => r.status === 401 || r.status === 403)) { console.error('La sesión no sirve (401 o 403): vuelve a iniciar sesión y guarda la cookie de nuevo.'); return 3; }
    if (res.some((r) => r.status !== 200)) fallo = true;
  }
  return fallo ? 1 : 0;
}
if (import.meta.url === `file://${process.argv[1]}`) principal(process.argv.slice(2)).then((c) => process.exit(c));
