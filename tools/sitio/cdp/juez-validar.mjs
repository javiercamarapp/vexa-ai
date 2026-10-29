#!/usr/bin/env node
// Valida la salida JSON del juez contra juez-esquema.json y rubrica.json y calcula la aprobación:
// promedio de cada celda de 8 o más y ningún criterio bajo 7 en ninguna celda.
// Uso: node juez-validar.mjs salida-del-juez.json
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RUBRICA = JSON.parse(readFileSync(join(AQUI, 'rubrica.json'), 'utf8'));

export function evaluarJuez(j) {
  const errores = [];
  const { promedioMinimoPorCelda, notaMinimaPorCriterio } = RUBRICA.aprobacion;
  if (typeof j.enterprise !== 'boolean') errores.push('falta enterprise (booleano)');
  const resumen = {};
  for (const celda of RUBRICA.celdas) {
    const c = j.celdas?.[celda];
    if (!c) { errores.push(`falta la celda ${celda}`); continue; }
    const cr = c.criterios || [];
    const ns = new Set(cr.map((x) => x.n));
    for (let n = 1; n <= 10; n++) if (!ns.has(n)) errores.push(`${celda}: falta el criterio ${n}`);
    for (const x of cr) {
      if (!Number.isInteger(x.nota) || x.nota < 1 || x.nota > 10) errores.push(`${celda} criterio ${x.n}: nota inválida`);
      if (!x.captura) errores.push(`${celda} criterio ${x.n}: sin captura que lo justifique`);
      if (x.nota < 9 && !x.accion) errores.push(`${celda} criterio ${x.n}: nota ${x.nota} sin acción concreta`);
    }
    const prom = cr.reduce((s, x) => s + x.nota, 0) / (cr.length || 1);
    const bajos = cr.filter((x) => x.nota < notaMinimaPorCriterio).map((x) => x.n);
    resumen[celda] = { promedio: Number(prom.toFixed(2)), bajos, aprueba: prom >= promedioMinimoPorCelda && bajos.length === 0 };
  }
  const aprueba = !errores.length && j.enterprise === true && Object.values(resumen).length === 4 && Object.values(resumen).every((r) => r.aprueba);
  return { errores, resumen, aprueba };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = evaluarJuez(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.aprueba ? 0 : 1);
}
