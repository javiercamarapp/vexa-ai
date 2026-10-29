// Medición previa de la Mac: uptime y vm.swapusage, con espera si hay carga alta.
import { execFileSync } from 'node:child_process';
import { UMBRAL_CARGA } from './config.mjs';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function parsearUptime(txt) {
  const m = /load averages?:\s*([\d.,]+)[ ,]+([\d.,]+)[ ,]+([\d.,]+)/.exec(txt);
  if (!m) return null;
  const n = (s) => Number(s.replace(',', '.'));
  return { carga1: n(m[1]), carga5: n(m[2]), carga15: n(m[3]) };
}

export function parsearSwap(txt) {
  // vm.swapusage: total = 9216.00M  used = 7475.50M  free = 1740.50M  (encrypted)
  const m = /total = ([\d.]+)M\s+used = ([\d.]+)M\s+free = ([\d.]+)M/.exec(txt);
  if (!m) return null;
  const total = Number(m[1]);
  const usado = Number(m[2]);
  return { totalMB: total, usadoMB: usado, libreMB: Number(m[3]), usadoPct: total > 0 ? (usado / total) * 100 : 0 };
}

export function medirMac() {
  const run = (c, a) => execFileSync(c, a, { encoding: 'utf8' });
  return {
    ...(parsearUptime(run('uptime', [])) || {}),
    swap: parsearSwap(run('sysctl', ['vm.swapusage'])),
  };
}

export function cargaAlta(m, u = UMBRAL_CARGA) {
  const razones = [];
  if (m.carga1 != null && m.carga1 > u.cargaMax) razones.push(`carga ${m.carga1} > ${u.cargaMax}`);
  if (m.swap && m.swap.usadoPct > u.swapUsadoMaxPct) razones.push(`swap ${m.swap.usadoPct.toFixed(0)}% > ${u.swapUsadoMaxPct}%`);
  return razones;
}

// Espera hasta que la carga baje. Si se agota la espera, falla salvo que forzar sea verdadero.
export async function esperarCargaBaja({ umbral = UMBRAL_CARGA, forzar = process.env.ROVAQ_FORZAR_CARGA === '1', log = console.warn } = {}) {
  const inicio = Date.now();
  for (;;) {
    const m = medirMac();
    const razones = cargaAlta(m, umbral);
    if (!razones.length) return { ...m, esperadoMs: Date.now() - inicio };
    if (Date.now() - inicio > umbral.esperaMaxMs) {
      if (forzar) {
        log(`ADVERTENCIA: la Mac sigue cargada (${razones.join(', ')}) y se sigue por ROVAQ_FORZAR_CARGA=1.`);
        return { ...m, esperadoMs: Date.now() - inicio, forzado: true, razones };
      }
      throw new Error(`Mac con carga alta tras ${Math.round(umbral.esperaMaxMs / 1000)} s (${razones.join(', ')}). Ajusta ROVAQ_CARGA_MAX o usa ROVAQ_FORZAR_CARGA=1.`);
    }
    log(`Esperando a que baje la carga: ${razones.join(', ')}`);
    await dormir(umbral.sondeoMs);
  }
}
