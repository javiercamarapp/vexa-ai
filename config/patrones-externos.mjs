// Patrones PROHIBIDOS que viven FUERA del repositorio (el repo es público: aquí no puede estar escrito ningún nombre real del cliente piloto,
// de sus bodegas, de sus personas ni de sus productos). Formato del archivo: una regla por línea, `clase|etiqueta|expresión regular` o `etiqueta|expresión regular`;
// las líneas vacías y las que empiezan por # se ignoran; la expresión se compara sin distinguir mayúsculas (sintaxis JavaScript). Un sufijo @t en la etiqueta se ignora.
// Ruta: variable VEXA_PATRONES_PROHIBIDOS o ~/.config/vexa/patrones-prohibidos.txt. Si no existe, la lista es vacía y las guardas que la usan se omiten
// (las huellas de tests/seguridad/datos-de-cliente.test.mjs siguen activas siempre).
import {existsSync, readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function rutaPatronesExternos(env = process.env) {
  const candidatas = [env.VEXA_PATRONES_PROHIBIDOS, path.join(os.homedir(), '.config/vexa/patrones-prohibidos.txt')].filter(Boolean);
  return candidatas.find((p) => existsSync(p)) ?? null;
}

/** Reglas {clase, id, rx} del archivo externo (vacío si no hay archivo). `clases` limita por clase (por defecto cliente y secreto; «aviso» nunca bloquea). */
export function patronesExternos({env = process.env, clases = ['cliente', 'secreto']} = {}) {
  const ruta = rutaPatronesExternos(env);
  if (!ruta) return [];
  const out = [];
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const l = linea.trim();
    if (!l || l.startsWith('#')) continue;
    const partes = l.split('|');
    const conClase = ['cliente', 'derivado', 'interno', 'secreto', 'aviso'].includes(partes[0]) && partes.length >= 3;
    const clase = conClase ? partes[0] : 'cliente';
    const id = (conClase ? partes[1] : partes[0]).replace(/@t$/, '');
    const fuente = (conClase ? partes.slice(2) : partes.slice(1)).join('|');
    if (!clases.includes(clase)) continue;
    try { out.push({clase, id, rx: new RegExp(fuente, 'i')}); } catch { /* regla inválida: se ignora */ }
  }
  return out;
}
