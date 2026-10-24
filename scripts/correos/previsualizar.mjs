#!/usr/bin/env node
// Renderiza TODAS las plantillas de correo con datos de ejemplo a una carpeta temporal para revisarlas en Chrome.
// No envía correo, no lee credenciales, no toca Supabase. Uso:
//   node scripts/correos/previsualizar.mjs [carpeta-de-salida]
// Con el modo oscuro del sistema activado, Chrome aplica el bloque prefers-color-scheme.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog as authCatalog, render as renderAuth, renderText as renderAuthText} from '../../support/F08-auth-brand/templates.mjs';
import {catalog as appCatalog, renderEmail} from '../../packages/notifications/email-template.mjs';
import {renderWeeklyReport} from '../../packages/notifications/email-weekly.mjs';
import {IDENTITY} from '../../packages/notifications/email-system.mjs';
import {GO_SAMPLE, APP_SAMPLE, WEEKLY_SAMPLE, ORIGIN, renderGoLite} from './muestras.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Todas las muestras: {id, grupo, asunto, html, text}. El logo apunta a las copias locales de img/. */
export function muestras() {
  const items = [];
  for (const item of authCatalog) {
    items.push({id: `auth-${item.id}`, grupo: item.notice ? 'Supabase Auth · avisos de seguridad' : 'Supabase Auth · acciones', asunto: item.subject, html: renderGoLite(renderAuth(item)), text: renderGoLite(renderAuthText(item))});
  }
  const sinDatos = authCatalog.find(i => i.id === 'invite');
  items.push({id: 'auth-invite-sin-datos', grupo: 'Supabase Auth · acciones', asunto: sinDatos.subject + ' (sin metadatos)', html: renderGoLite(renderAuth(sinDatos), {...GO_SAMPLE, '.Data.invita': '', '.Data.espacio': '', '.Data.rol': '', '.Data.rol_funcion': '', '.Data.rol_descripcion': '', '.Data.vence': ''}), text: renderGoLite(renderAuthText(sinDatos), {...GO_SAMPLE, '.Data.invita': '', '.Data.espacio': '', '.Data.rol': ''})});
  for (const e of appCatalog) {
    const label = e.labelAllowed ? 'Hubspot' : '';
    const r = renderEmail({type: e.type, ...APP_SAMPLE, resourceLabel: label});
    items.push({id: `app-${e.type}`, grupo: 'Notificaciones de la app', asunto: r.subject, html: r.html, text: r.text, headers: r.headers});
  }
  const w = renderWeeklyReport(WEEKLY_SAMPLE);
  items.push({id: 'app-reporte-semanal', grupo: 'Reporte semanal', asunto: w.subject, html: w.html, text: w.text, headers: w.headers});
  const vacio = renderWeeklyReport({...WEEKLY_SAMPLE, sinCambios: true, ingreso: {valor: 3_840_000, delta: 0.1}, reembolsos: {valor: 854_700, delta: -0.2}, atorado: {valor: null, delta: null, fuente: 'el libro de pedidos'}, hallazgo: undefined, dolores: [], accion: undefined});
  items.push({id: 'app-reporte-semanal-sin-cambios', grupo: 'Reporte semanal', asunto: vacio.subject, html: vacio.html, text: vacio.text, headers: vacio.headers});
  return items;
}

export function escribir(outDir) {
  fs.mkdirSync(path.join(outDir, 'img'), {recursive: true});
  for (const f of ['light', 'dark']) fs.copyFileSync(path.join(root, 'apps/web/public', IDENTITY.logo[f]), path.join(outDir, 'img', path.basename(IDENTITY.logo[f])));
  const local = html => html.replaceAll(`${ORIGIN}/email/`, 'img/');
  const items = muestras();
  for (const m of items) {
    fs.writeFileSync(path.join(outDir, m.id + '.html'), local(m.html));
    fs.writeFileSync(path.join(outDir, m.id + '.txt'), m.text);
  }
  const groups = [...new Set(items.map(m => m.grupo))];
  const li = m => `<li><a href="${m.id}.html">${m.id}</a> · ${m.asunto.length} car. · <em>${m.asunto.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</em> · <a href="${m.id}.txt">texto</a>${m.headers?.['List-Unsubscribe'] ? ' · baja' : ''}</li>`;
  fs.writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="es-MX"><meta charset="utf-8"><title>Vista previa de correos</title><body style="font:15px/1.5 system-ui;max-width:760px;margin:32px auto;padding:0 16px"><h1>Vista previa de correos de Rovaq</h1><p>Datos de ejemplo. Activa el modo oscuro del sistema para ver el diseño oscuro.</p>${groups.map(g => `<h2>${g}</h2><ul>${items.filter(m => m.grupo === g).map(li).join('')}</ul>`).join('')}</body></html>`);
  return {outDir, count: items.length};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = path.resolve(process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'rovaq-correos-')));
  const r = escribir(out);
  console.log(`${r.count} correos en ${r.outDir}\nAbrir: ${path.join(r.outDir, 'index.html')}`);
}
