#!/usr/bin/env node
// Accesibilidad con axe-core vendoreado (MPL-2.0, ~/vexa-tools/cdp/vendor/axe.min.js):
// cero violaciones serias o críticas en 390 y 1440, en claro y oscuro (SPEC 9 punto 6).
//
// Uso: node a11y.mjs --url URL [--vp 1440,390] [--esquema light,dark] [--json out.json]
import { writeFileSync } from 'node:fs';
import { leerArgs, lista } from './args.mjs';
import { leerAxe } from './playwright.mjs';
import { conSesion, dormir } from './navegador.mjs';

export const IMPACTOS_QUE_FALLAN = ['serious', 'critical'];

// Pura y probada: reduce el resultado de axe a las violaciones que cuentan.
export function violacionesGraves(resultado) {
  return (resultado.violations || [])
    .filter((v) => IMPACTOS_QUE_FALLAN.includes(v.impact))
    .map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.length, ejemplo: v.nodes[0]?.target?.join(' ') || null }));
}

export async function correrAxe(url, { vp, esquema, modo = 'normal' }) {
  const axe = await leerAxe();
  return conSesion({ vp, esquema, movimiento: modo === 'reduced' ? 'reduce' : 'no-preference', etiqueta: `axe ${vp} ${esquema}` }, async ({ page }) => {
    await page.goto(url, { waitUntil: 'load' });
    await dormir(modo === 'reduced' ? 600 : 3600);
    await page.evaluate(axe); // inyecta por Runtime.evaluate; axe queda como window.axe
    const r = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
    return { vp, esquema, total: r.violations.length, graves: violacionesGraves(r), todas: r.violations.map((v) => ({ id: v.id, impacto: v.impact, nodos: v.nodes.length })) };
  });
}

async function principal() {
  const a = leerArgs();
  if (!a.url) { console.error('Uso: node a11y.mjs --url URL [--vp 1440,390] [--esquema light,dark] [--modo reduced]'); process.exit(2); }
  const out = [];
  for (const vp of lista(a.vp, ['1440', '390'])) for (const esquema of lista(a.esquema, ['light', 'dark'])) {
    const r = await correrAxe(a.url, { vp, esquema, modo: a.modo });
    out.push(r);
    console.log(`${r.graves.length ? 'FALLA' : 'OK   '} ${vp} ${esquema}: ${r.graves.length} graves, ${r.total} violaciones en total`);
    for (const g of r.graves) console.log(`   ${g.impacto} ${g.id} (${g.nodos} nodos) ${g.ejemplo}`);
  }
  if (a.json) writeFileSync(a.json, JSON.stringify(out, null, 2));
  process.exit(out.some((r) => r.graves.length) ? 1 : 0);
}
if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => { console.error(e.message); process.exit(1); });
