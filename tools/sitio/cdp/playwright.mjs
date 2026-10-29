// Carga playwright-core desde ~/vexa-tools/cdp (su propio package-lock), nunca desde el repo.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { DIR_CDP } from './config.mjs';

const req = createRequire(join(DIR_CDP, 'package.json'));

export function cargarPlaywright() {
  try {
    return req('playwright-core');
  } catch (e) {
    throw new Error(
      `No se encontró playwright-core en ${DIR_CDP}. Corre: cd ${DIR_CDP} && npm ci. (${e.code || e.message})`,
    );
  }
}

// Lee axe.min.js de vendor/ y verifica el hash del lock antes de inyectarlo.
export async function leerAxe() {
  const { createHash } = await import('node:crypto');
  const ruta = join(DIR_CDP, 'vendor', 'axe.min.js');
  const lock = JSON.parse(readFileSync(join(DIR_CDP, 'vendor', 'vendor.lock.json'), 'utf8'));
  if (!existsSync(ruta)) throw new Error(`Falta ${ruta}`);
  const src = readFileSync(ruta);
  const h = createHash('sha256').update(src).digest('hex');
  if (h !== lock['axe-core'].sha256) throw new Error(`axe.min.js no coincide con el hash del lock (${h})`);
  return src.toString('utf8');
}
