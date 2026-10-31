// Pruebas de T9: mockups M1 a M6, diagramas de red e íconos. Se renderizan con react-dom/server en un proceso hijo (`node --import tsx`),
// porque son TSX, y se verifican: cero style, rótulo, alt, sumas que cuadran contra la fuente única de datos, sin marcas ni colores prohibidos,
// presupuesto de rojo y solo clases s-mock-, s-diag- y las de contrato de T6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escanearFuente, listarArchivos, sinComentariosCss, rel } from './_escaner.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const salida = execFileSync(process.execPath, ['--import', 'tsx', join(WEB, 'tests', 'sitio', '_render-mocks.tsx')], { cwd: WEB, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_NO_WARNINGS: '1' } });
const R = JSON.parse(salida.toString());
const D = R.datos;
const IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
const LANGS = ['es', 'en'];
const VARIANTES = ['completo', 'apoyo', 'miniatura'];
const suma = (xs) => xs.reduce((a, b) => a + b, 0);
const texto = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const textoSvg = (html) => html.replace(/<title[\s\S]*?<\/desc>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const clasesDe = (html) => [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
const todos = Object.entries(R.mocks);
const PERMITIDAS = /^(s-mock-[a-z0-9_-]+|s-diag-[a-z0-9_-]+|s-diag|s-ventana|s-ventana__barra|s-sello|s-sello__icono|s-sello--(observado|estimado|inferido|sindato)|s-indicador|s-raya|s-red|s-red__(nodo|linea|pulso|rotulo|marca|barrera)|s-red__nodo--(central|lleno)|s-red__linea--(tenue|punteada))$/;

// ---------- Fuente ----------
test('las fuentes de T9 no tienen style, use client ni construcciones prohibidas', () => {
  const archivos = ['mocks', 'diagramas', 'iconos'].flatMap((d) => listarArchivos(join(WEB, 'src', 'components', 'sitio', d), ['.ts', '.tsx']));
  assert.ok(archivos.length >= 9, `solo ${archivos.length} archivos`);
  for (const f of archivos) assert.deepEqual(escanearFuente(readFileSync(f, 'utf8'), rel(WEB, f)), [], f);
});

test('cada pantalla se rinde en los dos idiomas y en las tres variantes', () => {
  assert.equal(todos.length, 6 * 2 * 3);
  for (const [k, html] of todos) assert.ok(html.startsWith('<figure'), k);
});

// ---------- HTML ----------
for (const [k, html] of todos) {
  const [id, lang, variante] = k.split(':');
  test(`${k}: cero style, cero script, rótulo visible, alt, role img y solo clases permitidas`, () => {
    assert.ok(!/\sstyle\s*=/.test(html), 'atributo style');
    assert.ok(!/<script|\sinert\b|<h[1-6]\b|<button|<a\s|<img|<input/.test(html), 'etiqueta no permitida');
    const t = D.textos[lang];
    assert.ok(html.includes(`<p class="s-mock-rotulo">${t.rotulo}</p>`), 'rótulo visible dentro de la ventana');
    const alt = t[id].alt;
    const aria = /aria-label="([^"]*)"/.exec(html)[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
    assert.ok(aria.includes(alt) && aria.includes(t.rotulo), 'aria-label con la descripción y el rótulo');
    assert.match(html, /role="img"/);
    assert.match(html, new RegExp(`data-mock="${id}"`));
    assert.match(html, new RegExp(`data-variante="${variante}"`));
    for (const c of new Set(clasesDe(html))) assert.match(c, PERMITIDAS, `clase fuera de contrato: ${c}`);
    assert.equal((html.match(/s-ventana__barra/g) || []).length, 1);
    assert.equal((html.match(/class="s-mock-puntos"/g) || []).length, 1, 'tres puntos de ventana');
    assert.equal((/<span class="s-mock-puntos"[^>]*>(.*?)<\/span><span class="s-mock-ruta"/.exec(html)[1].match(/<span><\/span>/g) || []).length, 3);
  });

  test(`${k}: sin colores en bruto, sin marcas ni clientes, sin signos prohibidos`, () => {
    assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(html), 'color en bruto en el marcado');
    const t = texto(html);
    assert.ok(!/[()!¡¿?]/.test(t.replace(/[¿?]/g, '')), `paréntesis o exclamaciones: ${t.match(/.{15}[()!¡].{15}/)}`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(t), 'emoji');
    assert.ok(!/\b(Amazon|Walmart|Shopify|HubSpot|Zendesk|Mercado|eBay|Etsy|Stripe|PayPal|Google|Meta|Apple|Innovativos|Likida|Vexa|Atiende|Handle|Rovaq)\b/i.test(t), `marca o cliente: ${t.match(/Amazon|Walmart|Shopify|HubSpot|Zendesk/i)}`);
    assert.ok(!/\b(IA|AI|chatbot|copiloto|inteligencia artificial|artificial intelligence)\b/i.test(t), 'rótulo de IA');
    assert.ok(!/\b(MXN|CAD|EUR|MXN\$|€|£)\b/.test(t), 'mezcla de monedas');
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(t));
  });

  test(`${k}: presupuesto de rojo`, () => {
    const rojos = (html.match(/s-indicador/g) || []).length;
    const permitido = variante === 'miniatura' ? 0 : id === 'm1' || id === 'm6' ? 1 : 0;
    assert.equal(rojos, permitido, `${k} tiene ${rojos} indicadores rojos`);
  });
}

test('seis mockups: como máximo dos rojos visibles por pantalla en el recorrido completo y ninguno en las seis miniaturas', () => {
  const rojos = (v) => todos.filter(([k]) => k.endsWith(`:es:${v}`)).map(([, h]) => (h.match(/s-indicador/g) || []).length);
  assert.equal(suma(rojos('miniatura')), 0);
  assert.ok(suma(rojos('completo')) <= 2);
  assert.ok(Math.max(...rojos('apoyo')) <= 1);
});

test('paridad de estructura entre ES y EN: mismas etiquetas y clases', () => {
  const esqueleto = (h) => h.replace(/>[^<]+</g, '><').replace(/aria-label="[^"]*"/, '').replace(/\s(width|points|d|y|height|x)="[^"]*"/g, '');
  for (const id of IDS) for (const v of VARIANTES) {
    const a = esqueleto(R.mocks[`${id}:es:${v}`]).replace(/\sdata-[a-z-]+="[^"]*"/g, '');
    const b = esqueleto(R.mocks[`${id}:en:${v}`]).replace(/\sdata-[a-z-]+="[^"]*"/g, '');
    assert.equal(a, b, `${id} ${v}`);
  }
});

test('las seis pantallas son distintas entre sí', () => {
  const firmas = new Set(IDS.map((id) => R.mocks[`${id}:es:completo`].replace(/>[^<]+</g, '><').replace(/data-mock="m\d"/, '')));
  assert.equal(firmas.size, 6);
  const raices = new Set(IDS.map((id) => /class="(s-mock-m\d)"/.exec(R.mocks[`${id}:es:completo`])[1]));
  assert.equal(raices.size, 6, 'cada pantalla tiene su propia raíz s-mock-mN');
});

// ---------- Sumas ----------
test('la fuente única de datos suma lo que debe sumar', () => {
  assert.equal(suma(D.PARETO.map((p) => p.v)), D.REEMBOLSOS_TOP10, 'el Pareto suma los diez SKU principales');
  assert.equal((D.REEMBOLSOS_TOP10 / D.REEMBOLSOS * 100).toFixed(1), '67.9', 'los diez SKU principales explican el 67.9 % y no el 100 %');
  assert.equal(D.SKU_TOTAL, 62);
  assert.equal(D.PARETO.length, 10);
  assert.deepEqual([...D.PARETO.map((p) => p.v)], [...D.PARETO.map((p) => p.v)].sort((a, b) => b - a), 'Pareto ordenado de mayor a menor');
  assert.equal(new Set(D.PARETO.map((p) => p.sku)).size, 10);
  assert.equal(suma(D.totalesCanal), D.REEMBOLSOS, 'los canales suman los reembolsos');
  assert.equal(suma(D.totalesMes), D.REEMBOLSOS, 'los meses suman los reembolsos');
  assert.deepEqual(D.totalesCanal, [18500, 11200, 6300]);
  assert.equal(suma(D.SERIE_INGRESO), D.INGRESO_BRUTO);
  assert.equal(suma(D.SERIE_REEMBOLSOS), D.REEMBOLSOS);
  assert.ok(D.SERIE_INGRESO.every((v) => v > 0) && D.SERIE_REEMBOLSOS.every((v) => v > 0));
  assert.ok(D.REEMBOLSOS < D.INGRESO_BRUTO && D.INGRESO_EN_JUEGO < D.REEMBOLSOS && D.EXPOSICION_SUBTOTAL < D.INGRESO_BRUTO);
  assert.equal(D.INGRESO_BRUTO, 480000);
  assert.ok(D.INTENSIDAD.meses.every((v) => v > D.INTENSIDAD.umbral), 'la recomendación se apoya en meses sobre el umbral');
  assert.ok(D.PROBLEMAS.some((p) => p.clase === 'sindato') && D.PROBLEMAS.every((p) => p.clase === 'inferido' || p.clase === 'sindato'));
});

const fmt = (n) => n.toLocaleString('en-US');
for (const lang of LANGS) {
  test(`${lang}: los textos de T11 coinciden con las cifras de la fuente única`, () => {
    const t = D.textos[lang];
    assert.deepEqual(t.m1.tarjetas.slice(0, 3).map((c) => c.v), [`${fmt(D.INGRESO_BRUTO)} USD`, `${fmt(D.REEMBOLSOS)} USD`, `${fmt(D.DINERO_ATORADO)} USD`]);
    assert.ok(t.m2.titular.startsWith(`${fmt(D.REEMBOLSOS)} USD`));
    assert.deepEqual(t.m4.tabla.map((r) => r.v), D.totalesCanal.map((v) => `${fmt(v)} USD`), 'la tabla de Pregúntale es la de Fuga por canal');
    assert.ok(t.m5.enJuego.includes(`${fmt(D.INGRESO_EN_JUEGO)} USD`));
    assert.equal(t.m4.tabla.length, 3);
    assert.equal(t.m3.filas.length, 3);
    assert.equal(t.m3.filas.map((f) => Number(/\d+/.exec(f.casos)[0])).join(), D.PROBLEMAS.map((p) => p.casos).join());
    assert.equal(t.m3.filas.filter((f) => /Sin dato|No data/.test(f.expo)).length, D.PROBLEMAS.filter((p) => p.clase === 'sindato').length);
  });

  test(`${lang}: lo dibujado suma lo mismo que la fuente`, () => {
    const m1 = R.mocks[`m1:${lang}:completo`];
    for (const v of [D.INGRESO_BRUTO, D.REEMBOLSOS, D.DINERO_ATORADO]) assert.ok(m1.includes(fmt(v)), `M1 muestra ${v}`);
    assert.equal((m1.match(/class="s-sello s-sello--observado/g) || []).length, 4, 'M1 lleva cuatro tarjetas con su sello');
    assert.ok(/data-cifra="ingreso-bruto"/.test(m1));
    const m2 = R.mocks[`m2:${lang}:completo`];
    const celdas = [...m2.matchAll(/class="s-mock-celda s-mock-calor-\d">([\d,]+)</g)].map((m) => Number(m[1].replace(/,/g, '')));
    assert.equal(celdas.length, 9);
    assert.equal(suma(celdas), D.REEMBOLSOS, 'las nueve celdas por canal y mes suman los reembolsos');
    const totales = [...m2.matchAll(/class="s-mock-tabla__total">([\d,]+)</g)].map((m) => Number(m[1].replace(/,/g, '')));
    assert.deepEqual(totales, D.totalesCanal);
    const pie = [...m2.matchAll(/class="s-mock-tabla__pie">([\d,]+)</g)].map((m) => Number(m[1].replace(/,/g, '')));
    assert.deepEqual(pie, D.totalesMes);
    assert.ok(m2.includes(`>${fmt(D.REEMBOLSOS)}<`) || m2.includes(`${fmt(D.REEMBOLSOS)}<span`), 'el total general y el titular');
    const alturas = [...m2.matchAll(/<rect class="s-mock-barra-pareto[^"]*" x="[\d.]+" width="6" y="[\d.]+" height="([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.equal(alturas.length, 10);
    const tope = Math.ceil(Math.max(...D.PARETO.map((p) => p.v)) / 2000) * 2000;
    alturas.forEach((h, i) => assert.ok(Math.abs(h - (D.PARETO[i].v / tope) * 100) < 0.01, `barra ${i}`));
    const linea = /class="s-mock-acumulado" points="([^"]+)"/.exec(m2)[1].split(' ').map((p) => Number(p.split(',')[1]));
    assert.equal(linea.length, 10);
    assert.ok(Math.abs(linea[9] - (100 - (D.REEMBOLSOS_TOP10 / D.REEMBOLSOS) * 100)) < 0.01, 'el acumulado termina en el 67.9 por ciento, no en 100');
    assert.ok(linea.every((y, i) => i === 0 || y <= linea[i - 1]), 'el acumulado nunca baja');
    const m4 = R.mocks[`m4:${lang}:completo`];
    for (const v of D.totalesCanal) assert.ok(m4.includes(fmt(v)));
    assert.ok(m4.includes(`s-mock-m4fila--total`) && m4.includes(fmt(D.REEMBOLSOS)));
    const m3 = R.mocks[`m3:${lang}:completo`];
    assert.ok(m3.includes(fmt(D.EXPOSICION_SUBTOTAL)));
    assert.equal((m3.match(/s-sello--inferido/g) || []).length, 3, 'subtotal y dos problemas inferidos');
    assert.equal((m3.match(/s-sello--sindato/g) || []).length, 1);
    assert.equal((m3.match(/class="s-raya"/g) || []).length, 1, 'Sin dato lleva raya y nunca cero');
    const m5 = R.mocks[`m5:${lang}:completo`];
    assert.ok(m5.includes(fmt(D.INGRESO_EN_JUEGO)) && m5.includes('s-sello--inferido'));
    const m6 = R.mocks[`m6:${lang}:completo`];
    assert.equal((m6.match(/data-estado="aldia"/g) || []).length, 2, 'icono y estado de la fuente al día');
  });

  test(`${lang}: M4 corre con reglas, sin modelo de lenguaje, con pregunta, tabla, sello y pasos`, () => {
    const t = D.textos[lang].m4;
    const html = R.mocks[`m4:${lang}:completo`];
    const tx = texto(html);
    for (const s of [t.pregunta, t.respuesta, t.sello.split('. ')[0], t.desplegable, ...t.pasos, t.notaPasos]) assert.ok(tx.includes(s.replace(/\.$/, '')), s);
    assert.match(t.notaPasos, /sin modelo de lenguaje|without a language model/);
    assert.equal((html.match(/<li>/g) || []).length, 3);
  });
}

// ---------- Colores y CSS ----------
test('mocks.css usa solo variables --s-*, ni hex, ni colores nombrados, ni verde, ámbar, azul o lima, ni acento', () => {
  const css = sinComentariosCss(readFileSync(join(WEB, 'src', 'styles', 'sitio', 'mocks.css'), 'utf8'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'hex en bruto');
  assert.ok(!/\b(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/.test(css), 'color funcional en bruto');
  assert.ok(!/\b(green|lime|amber|orange|yellow|blue|cyan|teal|red|crimson)\b/i.test(css), 'color nombrado');
  assert.ok(!/--s-acento/.test(css), 'el rojo solo lo lee .s-indicador de T6');
  for (const m of css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) assert.ok(m[1].startsWith('--s-'), `variable ajena ${m[1]}`);
  assert.ok(!/prefers-reduced-motion:\s*reduce/.test(css) && !/animation|transition/.test(css), 'sin animaciones propias ni segundo bloque reduce');
  assert.ok(!/!important/.test(css));
  for (const sel of css.matchAll(/\.([a-z][a-z0-9_-]*)/gi)) assert.match(sel[1], /^(s-mock|s-diag|s-red|s-ventana|s-sello|s-indicador|s-raya)/, `selector ${sel[1]}`);
});

test('los cuatro sellos existen y se distinguen por patrón: relleno, rayado, punteado y guiones', () => {
  for (const c of ['observado', 'estimado', 'inferido', 'sindato']) assert.match(R.sellos[c], new RegExp(`s-sello--${c}`));
  const base = sinComentariosCss(readFileSync(join(WEB, 'src', 'styles', 'sitio', 'base.css'), 'utf8'));
  const bloque = (n) => new RegExp(`\\.s-sello--${n}\\s*\\{([^}]*)\\}`).exec(base)[1];
  assert.match(bloque('observado'), /background:\s*var\(--s-tinta\)/);
  assert.match(bloque('estimado'), /repeating-linear-gradient/);
  assert.match(bloque('inferido'), /border-style:\s*dotted/);
  assert.match(bloque('sindato'), /border-style:\s*dashed/);
  for (const c of ['observado', 'estimado', 'inferido', 'sindato']) assert.ok(!/color:\s*(#|rgb)/.test(bloque(c)), 'el sello no usa color');
});

// ---------- Diagramas ----------
const diag = Object.entries(R.diagramas);
const NOMBRES_OK = /\b(HubSpot|Excel|CSV|Amazon|Walmart|Shopify)\b/;
for (const [k, html] of diag) {
  const [id, lang] = k.split(':');
  test(`diagrama ${k}: sin style, con title y desc enlazados, accesible, currentColor y sin color en bruto`, () => {
    assert.ok(!/\sstyle\s*=/.test(html) && !/<script|\sinert\b|<image|<img|<foreignObject/.test(html));
    assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(html), 'color en bruto');
    assert.ok(!/\b(fill|stroke)="(?!none|currentColor)[^"]*"/.test(html), 'fill o stroke en bruto');
    const svgs = html.split('<svg').length - 1;
    assert.ok(svgs === 1 || svgs === 2, 'un SVG, o dos con la variante angosta');
    const m = /<svg class="s-red s-diag[^"]*" viewBox="0 (?:\d+) (\d+) (\d+)" role="img" aria-labelledby="(s-diag-[a-z0-9-]+-t) (s-diag-[a-z0-9-]+-d)"/.exec(html);
    assert.ok(m, 'svg principal con role img y aria-labelledby');
    assert.match(html, new RegExp(`<title id="${m[3]}">[^<]{4,}</title><desc id="${m[4]}">[^<]{30,}</desc>`));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
    assert.equal(new Set(ids).size, ids.length, 'ids únicos');
    for (const c of new Set(clasesDe(html))) assert.match(c, PERMITIDAS, `clase fuera de contrato: ${c}`);
    const t = textoSvg(html);
    assert.ok(!/[()!¡]/.test(t) && !/\p{Extended_Pictographic}/u.test(t));
    const marcas = (html.match(/s-red__marca/g) || []).length;
    assert.equal(marcas, id === 'problema-2' ? 1 : 0, 'una sola marca roja y solo en el corte');
    const nombres = t.match(new RegExp(NOMBRES_OK, 'g')) || [];
    if (!['integraciones', 'procedencia'].includes(id)) assert.equal(nombres.length, 0, 'marcas solo como texto en integraciones y procedencia');
    const rot = [...html.matchAll(/<text class="([^"]*)"/g)];
    assert.ok(rot.every((r) => /s-diag-(rotulo|nombre|cifra)/.test(r[1])), 'rótulos con clase mono');
    if (['seguridad', 'integraciones', 'procedencia'].includes(id)) {
      assert.match(html, /class="s-diag-ancho"/);
      assert.match(html, /class="s-diag-angosto" aria-hidden="true"/);
    }
    if (id.startsWith('problema')) { assert.ok(m[1] === '244' && m[2] === '124', '244 por 124'); assert.match(html, /viewBox="0 24 244 124"/, 'recorte de 24 a 148'); }
    if (id === 'seguridad') assert.ok(m[1] === '1072' && m[2] === '380');
    if (id === 'integraciones') assert.ok(m[1] === '800' && m[2] === '280');
  });
}

test('el texto alternativo de los diagramas es el de T11', () => {
  for (const lang of LANGS) {
    const p = (i) => R.diagramas[`problema-${i}:${lang}`];
    const alts = { es: ['tres grupos de nodos separados', 'una conexión interrumpida', 'una línea de tiempo', 'cuatro nodos y una cifra'], en: ['three separate groups', 'a broken connection', 'a timeline', 'four nodes and a figure'] };
    alts[lang].forEach((frag, i) => assert.ok(p(i + 1).includes(frag), `${lang} problema ${i + 1}`));
    assert.ok(R.diagramas[`seguridad:${lang}`].includes(lang === 'es' ? 'tres grupos de nodos, uno por organización' : 'three groups of nodes, one per organization'));
    assert.ok(R.diagramas[`integraciones:${lang}`].includes(lang === 'es' ? 'hoja de ruta' : 'roadmap'));
  }
});

test('el diagrama de seguridad rotula las tres organizaciones y las reglas en la base de datos', () => {
  const h = textoSvg(R.diagramas['seguridad:es']);
  for (const o of ['Organización A', 'Organización B', 'Organización C']) assert.ok(h.includes(o));
  assert.ok(h.includes('Reglas en la base de datos'));
  const en = textoSvg(R.diagramas['seguridad:en']);
  assert.ok(en.includes('Organization C') && en.includes('Rules in the database'));
});

test('el diagrama de integraciones tiene dos conexiones continuas y tres discontinuas', () => {
  const ancho = R.diagramas['integraciones:es'].split('class="s-diag-angosto"')[0];
  assert.equal((ancho.match(/class="s-red__linea s-red__linea--punteada"/g) || []).length, 3);
  assert.equal((ancho.match(/class="s-red__linea"/g) || []).length, 2);
  assert.equal((ancho.match(/class="s-red__pulso"/g) || []).length, 2);
});

// ---------- Íconos ----------
const NOMBRES = ['conversacion', 'pedido', 'problema', 'accion', 'evidencia', 'lupa', 'sello', 'candado', 'persona', 'fuentes', 'flujo', 'acceso'];
test('íconos: los nueve del encargo más tres del hilo, de trazo 1 px sobre rejilla de 16, con currentColor', () => {
  for (const n of NOMBRES) {
    const h = R.iconos[n];
    assert.ok(h, n);
    assert.match(h, /viewBox="0 0 16 16"/);
    assert.match(h, /width="16" height="16"/);
    assert.match(h, /stroke="currentColor"/);
    assert.match(h, /stroke-width="1"/);
    assert.match(h, /fill="none"/);
    assert.match(h, /aria-hidden="true"/);
    assert.ok(!/\sstyle\s*=|#[0-9a-f]{3,8}\b|<title/.test(h));
    assert.ok(!/stroke-width="(?!1")/.test(h), 'todos los trazos de 1 px');
  }
  assert.equal(Object.keys(R.iconos).filter((k) => !k.startsWith('__')).length, NOMBRES.length);
  assert.match(R.iconos.__titulo, /role="img" aria-label="Lupa"/);
  assert.match(R.iconos.__titulo, /<title>Lupa<\/title>/);
  assert.equal(new Set(NOMBRES.map((n) => R.iconos[n])).size, NOMBRES.length, 'ninguno repetido');
});

test('íconos del hilo: siete, uno por nota, todos existentes', () => {
  assert.equal(R.hilo.length, 7);
  for (const n of R.hilo) assert.ok(NOMBRES.includes(n), n);
});
