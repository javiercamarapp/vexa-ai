#!/usr/bin/env node
// Prueba de rojo (SPEC sección 9 punto 8 y 1.3): en capturas de 1440x900 tomadas cada
// 300 px de scroll, como máximo tres elementos con #E8241C y 0.3 por ciento del área.
//
// Uso: node rojo.mjs --url URL [--esquema light,dark] [--paso 300]
//      node rojo.mjs --carpeta DIR_CON_PNG          (analiza capturas ya hechas)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerArgs, lista } from './args.mjs';
import { decodificarPng } from './png.mjs';
import { COLOR_ACENTO } from './config.mjs';

export const LIMITES = { elementos: 3, areaPct: 0.3 };
const TOLERANCIA = 40; // distancia euclidiana en RGB: absorbe el antialiasing de los bordes
const AREA_MIN_PX = 4; // por debajo es ruido de borde, no un elemento
const FUSION_PX = 6; // dos manchas a menos de 6 px son un mismo elemento (punto y su borde)

export function analizarRojo({ ancho, alto, canales, datos }, { tolerancia = TOLERANCIA, areaMin = AREA_MIN_PX, fusion = FUSION_PX } = {}) {
  const { r, g, b } = COLOR_ACENTO;
  const t2 = tolerancia * tolerancia;
  const etiqueta = new Int32Array(ancho * alto).fill(-1);
  const padre = [];
  const buscar = (x) => { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; };
  const unir = (a, c) => { a = buscar(a); c = buscar(c); if (a !== c) padre[c] = a; };
  let rojos = 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * canales;
      const dr = datos[i] - r, dg = datos[i + 1] - g, db = datos[i + 2] - b;
      if (dr * dr + dg * dg + db * db > t2) continue;
      rojos++;
      const id = padre.length;
      padre.push(id);
      etiqueta[y * ancho + x] = id;
      for (const [dx, dy] of [[-1, 0], [-1, -1], [0, -1], [1, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= ancho) continue;
        const v = etiqueta[ny * ancho + nx];
        if (v >= 0) unir(id, v);
      }
    }
  }
  // Cajas por componente.
  const cajas = new Map();
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const v = etiqueta[y * ancho + x];
    if (v < 0) continue;
    const k = buscar(v);
    const c = cajas.get(k);
    if (!c) cajas.set(k, { x0: x, y0: y, x1: x, y1: y, px: 1 });
    else { if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y; c.px++; }
  }
  let comps = [...cajas.values()].filter((c) => c.px >= areaMin);
  // Fusión de cajas cercanas, hasta que no haya más.
  let cambio = true;
  while (cambio) {
    cambio = false;
    outer: for (let i = 0; i < comps.length; i++) for (let j = i + 1; j < comps.length; j++) {
      const a = comps[i], c = comps[j];
      if (a.x0 - fusion <= c.x1 && c.x0 - fusion <= a.x1 && a.y0 - fusion <= c.y1 && c.y0 - fusion <= a.y1) {
        comps[i] = { x0: Math.min(a.x0, c.x0), y0: Math.min(a.y0, c.y0), x1: Math.max(a.x1, c.x1), y1: Math.max(a.y1, c.y1), px: a.px + c.px };
        comps.splice(j, 1);
        cambio = true;
        break outer;
      }
    }
  }
  const pxContados = comps.reduce((s, c) => s + c.px, 0);
  return { ancho, alto, pxRojos: rojos, pxElementos: pxContados, areaPct: (pxContados / (ancho * alto)) * 100, elementos: comps.length, cajas: comps };
}

export function veredictoRojo(a) {
  const fallas = [];
  if (a.elementos > LIMITES.elementos) fallas.push(`${a.elementos} elementos rojos (máximo ${LIMITES.elementos})`);
  if (a.areaPct > LIMITES.areaPct) fallas.push(`${a.areaPct.toFixed(3)} % del área (máximo ${LIMITES.areaPct} %)`);
  return fallas;
}

export function analizarArchivoPng(ruta) {
  return analizarRojo(decodificarPng(readFileSync(ruta)));
}

async function desdeUrl(a) {
  const { conSesion, dormir } = await import('./navegador.mjs');
  const paso = a.paso ? Number(a.paso) : 300;
  const res = [];
  for (const esquema of lista(a.esquema, ['light', 'dark'])) {
    await conSesion({ vp: 1440, esquema, etiqueta: 'rojo ' + esquema }, async (s) => {
      await s.page.goto(a.url, { waitUntil: 'load' });
      await dormir(3600);
      const total = await s.page.evaluate(() => document.documentElement.scrollHeight);
      const max = Math.max(0, total - 900);
      for (let y = 0; y <= max + paso; y += paso) {
        const yy = Math.min(y, max);
        await s.page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), yy);
        await dormir(500);
        const png = await s.page.screenshot();
        const an = analizarRojo(decodificarPng(png));
        res.push({ esquema, y: yy, ...an, cajas: an.cajas, fallas: veredictoRojo(an) });
        if (yy >= max) break;
      }
    });
  }
  return res;
}

async function principal() {
  const a = leerArgs();
  let res = [];
  if (a.carpeta) {
    for (const f of readdirSync(a.carpeta).filter((n) => n.endsWith('.png')).sort()) {
      const an = analizarArchivoPng(join(a.carpeta, f));
      res.push({ archivo: f, ...an, fallas: veredictoRojo(an) });
    }
  } else if (a.url) res = await desdeUrl(a);
  else { console.error('Uso: node rojo.mjs --url URL | --carpeta DIR'); process.exit(2); }
  for (const r of res) console.log(`${r.fallas.length ? 'FALLA' : 'OK   '} ${r.archivo || r.esquema + ' y=' + r.y}: ${r.elementos} elementos, ${r.areaPct.toFixed(3)} %${r.fallas.length ? ' -> ' + r.fallas.join('; ') : ''}`);
  if (a.json) writeFileSync(a.json, JSON.stringify(res, null, 2));
  const malas = res.filter((r) => r.fallas.length).length;
  console.log(`${res.length} capturas, ${malas} con falla`);
  process.exit(malas ? 1 : 0);
}
if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => { console.error(e.message); process.exit(1); });
