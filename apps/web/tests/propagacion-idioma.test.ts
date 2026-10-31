// T42: el idioma TIENE que llegar de la petición a la pantalla. Cada prueba falla si alguien quita el idioma de un eslabón (agente, informe CFO, memo de puntos de dolor, Hoy,
// caché del navegador), si pone español en el diccionario inglés o si usa ortografía británica. Las mutaciones que las matan están en ~/vexa-notas-28oct/ingles/T42-NOTAS.md.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {claveMemoPuntos} from '../src/lib/pain-points/server';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

// ---- Eslabones de la cadena petición -> idioma ----
test('/api/agent/turn lee el idioma de la cookie y lo pasa a agent.answer', () => {
  const s = leer('src/app/api/agent/turn/route.ts');
  assert.match(s, /const idioma=idiomaDePeticion\(request\)/);
  assert.match(s, /agent\.answer\(\{[^}]*\bidioma\}\)/);
});
test('/api/agent/state y las rutas del CFO (informe, exportes, copiloto) pasan el idioma de la petición', () => {
  assert.match(leer('src/app/(app)/(workspace)/cfo/data/report/route.ts'), /loadReport\(r\.access, idiomaDePeticion\(request\)\)/);
  assert.match(leer('src/app/(app)/(workspace)/cfo/data/export/route.ts'), /loadReport\(r\.access, idiomaDePeticion\(request\)\)/);
  assert.match(leer('src/app/(app)/(workspace)/cfo/data/copilot/route.ts'), /idioma: idiomaDePeticion\(request\)/);
  assert.match(leer('src/app/api/agent/state/route.ts'), /idiomaDePeticion\(request\)/);
});
test('memo de puntos de dolor: el inglés tiene su propia clave y el handler la usa con el idioma de la petición', () => {
  assert.notEqual(claveMemoPuntos('t', 'owner', 'en'), claveMemoPuntos('t', 'owner', 'es'));
  assert.equal(claveMemoPuntos('t', 'owner', 'en'), 't|owner|pain-points|en');
  assert.equal(claveMemoPuntos('t', 'owner', 'es'), 't|owner|pain-points');
  const s = leer('src/lib/pain-points/server.ts');
  assert.match(s, /const idioma=idiomaDePeticion\(request\);\n\s*const clave=claveMemoPuntos\(c\.tenant,c\.role,idioma\);/);
  assert.match(s, /\.get\(\{idioma\}\)/);
});
test('Hoy: la pantalla pasa el idioma activo a armarHoy y lo declara como dependencia del memo', () => {
  const s = leer('src/components/hoy/hoy-pantalla.tsx');
  assert.match(s, /idioma=useIdioma\(\)/);
  assert.match(s, /armarHoy\(\{[^}]*estado,idioma\}\)/);
  assert.match(s, /estado\.cfo,idioma\]\)/);
});
test('caché del navegador: el shell fija el idioma activo y el selector lo fija y relee las vistas al cambiar', () => {
  assert.match(leer('src/components/workspace/shell.tsx'), /const idioma=useIdioma\(\);[\s\S]{0,200}fijarIdioma\(idioma\)/);
  const sel = leer('src/components/i18n/selector-idioma.tsx');
  assert.match(sel, /fijarIdioma\(idioma\)/); assert.match(sel, /new Event\('vexa:refresh'\)/);
  assert.match(leer('src/lib/workspace/swr.mjs'), /PREFIJO\+tenant\+'\|'\+ruta\+'\?'\+p\.toString\(\)\+'\|'\+\(idioma==='en'\?'en':'es'\)/);
});

// ---- Diccionario inglés ----
const EN = en as Record<string, string>, ES = es as Record<string, string>;
const sinVars = (t: string) => t.replace(/\{\w+\}/g, '');
const ACENTOS = /[áéíóúñ¿¡«»]/i;
const PAL = /\b(de|del|la|las|los|el|para|por|sin|con|una?|que|se|su|más|hay|datos|todos?|cargando|guardar|cancelar|cerrar|buscar|volver|siguiente|anterior|cliente|clientes|pedidos|ventas|mes|meses|semana|días?|esta|este|entre|desde|hasta|pero|como|tu|tus|nuevo|nueva|ver|aún|ya|aquí|sobre|fuente|fuentes|estado|período|periodo|cobertura|falta|reembolsos?|ingresos?|problemas?|canal|canales|casos|importe|moneda|monedas|cifra|cifras|tasa|promedio|registros|filas)\b/gi;
const espanol = (v: string) => ACENTOS.test(sinVars(v)) || (sinVars(v).match(PAL) ?? []).length >= 2;
/** Autónimo del idioma y nombres de las hojas del archivo del cliente (datos, no interfaz). */
const ESPANOL_PERMITIDO = new Set(['idioma.es', 'tr.fuga.soloHoja']);
test('inglés: ningún valor de en.ts lleva español (palabras o acentos), salvo el autónimo «Español» y los nombres de hojas del archivo', () => {
  const malos = Object.entries(EN).filter(([k, v]) => !ESPANOL_PERMITIDO.has(k) && espanol(v)).map(([k, v]) => `${k} = ${v.slice(0, 80)}`);
  assert.deepEqual(malos, []);
  assert.ok(espanol('Estado del período: sin datos') && espanol('Hola ñandú') && !espanol('Orders by channel'), 'el detector funciona');
});
/** Valores que son idénticos en ambos idiomas por ser nombres propios, marcas, siglas o préstamos (no traducibles). Una clave NUEVA idéntica al español debe justificarse aquí. */
const IDENTICOS_PERMITIDOS = /^(idioma\.(es|en)|pp\.eyebrow|cfo\.mix\.total|conx\.a\.cc\.push|conx\.i\.v\.ticket|cargador\.campo\.marketplace|mapa\.(retailer|provisional)|cco\.(th\.(total|mkt)|mod\.val\.(amazon|walmart)|sub\.(amazon_com|bestbuy|lowes|homedepot))|prob\.adj\.video(1|N)|det\.probable|tr\.datos\.crManual|tr\.brecha\.(total|pCancel|nSkusPos)|tr\.pp\.thTracker|tr\.assoc\.(thPortal|thTicket)|tr\.cand\.config|tr\.emb\.global|tr\.eval\.thFeedback|tr\.ext\.global|tr\.iv\.(control|planV)|tr\.mc\.comparable|tr\.mn\.(lblOriginal|original)|tr\.pl\.(total|actor|admin|normal|srcZendesk|stError)|tr\.lg\.(fte\.(zendesk|amazon|walmart|bestbuy|shopify)|err\.otro|fu\.nom\.(hubspot|zendesk))|tr\.sec\.actor|onb\.pant\.settings-team\.claveT|landing\.(hero\.pill|pie\.derechos))$/;
test('inglés: ninguna cadena queda idéntica al español (copiada sin traducir) fuera de nombres propios y préstamos justificados', () => {
  const iguales = Object.keys(ES).filter((k) => EN[k] === ES[k] && /[a-zA-Z]{4,}/.test(sinVars(EN[k])) && !/^[A-Z0-9 &/·.\-{}%:,]+$/.test(EN[k]) && !IDENTICOS_PERMITIDOS.test(k));
  assert.deepEqual(iguales, [], 'texto sin traducir en en.ts');
});
test('inglés americano: sin ortografía británica (colour, organise, catalogue, grey, travelling, licence…)', () => {
  const BRIT = /colour|behaviour|favour|honour|labour|neighbour|organis|\bcentre\b|catalogue|programme|\bgrey\b|whilst|travell|modell|labell|\blicence\b|defence|offence|judgement|ageing|\banalys(e|ed|ing)\b|cancell(ed|ing)|recognis|utilis|summaris|customis|prioritis|normalis|authoris/i;
  assert.deepEqual(Object.entries(EN).filter(([, v]) => BRIT.test(v)).map(([k, v]) => `${k} = ${v.slice(0, 60)}`), []);
  assert.ok(BRIT.test('Pick a colour') && BRIT.test('We organise it') && !BRIT.test('Pick a color, canceled'), 'el detector funciona');
});
test('inglés: «Assignee» en columnas y campos, «responsible» en frases (nunca «Responsible:» como etiqueta)', () => {
  assert.deepEqual(Object.entries(EN).filter(([, v]) => /(^|· )Responsible:/.test(v)).map(([k]) => k), []);
  assert.equal(EN['tr.iv.respAsig'], 'Assignee: assigned'); assert.equal(EN['tr.iv.respSin'], 'Assignee: unassigned');
  assert.match(EN['tr.brief.responsable'], /· Assignee: \{quien\}/);
  assert.match(EN['recs.notaResp'], /person responsible/);
});
