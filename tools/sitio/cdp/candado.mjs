// Candado de Chrome: un solo proceso de Chrome a la vez en toda la Mac.
// Compatible con los scripts viejos (mkdir atómico sobre /tmp/chrome-cdp.lock) y con
// detección de candado obsoleto: dueño inexistente o más de 15 minutos de edad.
import { mkdirSync, writeFileSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CANDADO, CANDADO_MAX_EDAD_MS } from './config.mjs';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function pidVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM'; // existe pero es de otro usuario
  }
}

// Devuelve { obsoleto, motivo, dueno, edadMs } para un candado existente.
export function evaluarCandado(ruta = CANDADO, ahora = Date.now(), maxEdad = CANDADO_MAX_EDAD_MS, vivo = pidVivo) {
  if (!existsSync(ruta)) return { existe: false, obsoleto: false };
  let dueno = null;
  try {
    dueno = JSON.parse(readFileSync(join(ruta, 'dueno.json'), 'utf8'));
  } catch {
    /* candado de un script viejo sin archivo de dueño */
  }
  const edadMs = ahora - (dueno?.t ?? statSync(ruta).mtimeMs);
  if (dueno && !vivo(dueno.pid)) return { existe: true, obsoleto: true, motivo: `el dueño (pid ${dueno.pid}) ya no existe`, dueno, edadMs };
  if (edadMs > maxEdad) return { existe: true, obsoleto: true, motivo: `tiene ${Math.round(edadMs / 60000)} min (más de ${Math.round(maxEdad / 60000)})`, dueno, edadMs };
  return { existe: true, obsoleto: false, dueno, edadMs };
}

export async function adquirir({ ruta = CANDADO, esperaMaxMs = 30 * 60 * 1000, etiqueta = 'cdp', log = console.warn } = {}) {
  const inicio = Date.now();
  for (;;) {
    try {
      mkdirSync(ruta);
      writeFileSync(join(ruta, 'dueno.json'), JSON.stringify({ pid: process.pid, t: Date.now(), etiqueta }));
      let liberado = false;
      const liberar = () => {
        if (liberado) return;
        liberado = true;
        try {
          rmSync(ruta, { recursive: true, force: true });
        } catch {
          /* ya no está */
        }
      };
      process.once('exit', liberar);
      for (const s of ['SIGINT', 'SIGTERM']) process.once(s, () => { liberar(); process.exit(130); });
      return { liberar };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const est = evaluarCandado(ruta);
      if (est.obsoleto) {
        log(`ADVERTENCIA: candado ${ruta} obsoleto (${est.motivo}); se borra.`);
        rmSync(ruta, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - inicio > esperaMaxMs) throw new Error(`Candado ${ruta} ocupado por ${JSON.stringify(est.dueno)} más de ${esperaMaxMs} ms`);
      await dormir(2000);
    }
  }
}
