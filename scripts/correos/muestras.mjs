// Datos de ejemplo y un intérprete mínimo de las plantillas Go de Supabase, solo para previsualizar y probar.
// No es el motor real de Supabase: cubre exactamente `{{ .Var }}`, `{{ or A "texto" }}`, `{{ if A }}` y `{{ end }}`.
import {escapeHtml} from '../../packages/notifications/email-system.mjs';

export const ORIGIN = 'https://rovaq-ai.vercel.app';

export const GO_SAMPLE = Object.freeze({
  '.Email': 'ana.torres@empresa-ejemplo.mx',
  '.NewEmail': 'ana.nueva@empresa-ejemplo.mx',
  '.ConfirmationURL': `${ORIGIN}/auth/v1/verify?token=EJEMPLO&type=magiclink`,
  '.Token': '482913',
  '.SiteURL': ORIGIN,
  '.Provider': 'Google',
  '.FactorType': 'totp',
  '.Data.invita': 'Ana Torres',
  '.Data.espacio': 'Casa Aldama',
  '.Data.rol': 'Analista',
  '.Data.rol_funcion': 'consultar y analizar datos y preparar informes',
  '.Data.rol_descripcion': 'consulta y analiza datos, prepara informes',
  '.Data.vence': '31 de octubre de 2026, 11:59 p. m. (hora CDMX)',
});

/** Sustituye variables Go. Una clave ausente de `data` se comporta como vacía (campo faltante). */
export function renderGoLite(template, data = GO_SAMPLE, {escape = false} = {}) {
  const parts = template.split(/(\{\{[\s\S]*?\}\})/g);
  const out = [];
  const stack = [];
  const on = () => stack.every(Boolean);
  const val = name => (Object.hasOwn(data, name) ? data[name] : '');
  const show = v => (escape ? escapeHtml(v) : v);
  for (const part of parts) {
    const m = /^\{\{\s*([\s\S]*?)\s*\}\}$/.exec(part);
    if (!m) { if (on()) out.push(part); continue; }
    const expr = m[1];
    let r;
    if (expr === 'end') { if (!stack.length) throw Error('go_unbalanced_end'); stack.pop(); continue; }
    if ((r = /^if (\.[\w.]+)$/.exec(expr))) { stack.push(!!val(r[1])); continue; }
    if (!on()) continue;
    if ((r = /^or (\.[\w.]+) "([^"]*)"$/.exec(expr))) { out.push(show(val(r[1]) || r[2])); continue; }
    if ((r = /^(\.[\w.]+)$/.exec(expr))) { out.push(show(val(r[1]))); continue; }
    throw Error('go_unsupported:' + expr);
  }
  if (stack.length) throw Error('go_unbalanced_if');
  return out.join('');
}

export const APP_SAMPLE = Object.freeze({
  appOrigin: ORIGIN,
  ctaUrl: `${ORIGIN}/overview`,
  unsubscribeUrl: `${ORIGIN}/api/notifications/unsubscribe`,
  espacio: 'Casa Aldama',
  rol: 'Analista',
  invita: 'Ana Torres',
  vence: '2026-11-01T05:59:00Z',
});

/** Reporte semanal de ejemplo: cifras ilustrativas, no reales (iguales a la maqueta 05). */
export const WEEKLY_SAMPLE = Object.freeze({
  appOrigin: ORIGIN,
  espacio: 'Casa Aldama',
  rol: 'Propietario',
  rango: '14 al 20 de octubre de 2026',
  rangoCorto: '14–20 oct',
  corte: '20 oct',
  ingreso: {valor: 3_840_000, delta: 4.2},
  reembolsos: {valor: 854_700, delta: 11},
  atorado: {valor: 212_000, delta: 2},
  vencidas: {valor: 14, antes: 6},
  hallazgo: {nSku: 10, pctSku: 59},
  fraseClave: 'La fuga de reembolsos creció 11 % y concentra el problema en pocos productos.',
  dolores: [
    {label: 'Producto llegó dañado', monto: 241_000},
    {label: 'Talla o ajuste incorrecto', monto: 173_000},
    {label: 'Entrega fuera de fecha', monto: 128_000},
  ],
  accion: {titulo: 'Revisar el empaque de los 3 SKUs con más devoluciones por daño', impacto: 'Podrían recuperarse hasta $96k al mes. Estimado a partir de 8 semanas de historial.'},
  fuentes: ['libro de pedidos', 'HubSpot'],
  urls: {informe: `${ORIGIN}/briefs`, metodo: `${ORIGIN}/ayuda/calculo`, preferencias: `${ORIGIN}/settings/notifications`, baja: `${ORIGIN}/api/notifications/unsubscribe`},
});
