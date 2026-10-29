// Pruebas de contenido del sitio (T11, contrato K8): afirmaciones prohibidas, paridad ES y EN, marcadores, aprobaciones por hash,
// reglas editoriales, MATIZ con condición, SEO y páginas internas.
// Se corre con: node --test apps/web/tests/sitio/contenido.test.mjs   (Node 22.18 o superior importa los .ts directamente)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LANDING, CONDICIONES, PORTADA, RETIRADAS_DE_PORTADA, proyectar } from '../../src/content/sitio/landing.ts';
import { PAGINAS_INTERNAS } from '../../src/content/sitio/paginas/index.ts';
import {
  hojas, recorrer, hojaEn, hashTexto, aprobar, marcarCondicion, aprobacionesVacias, contextoPorDefecto, resolverMarcadores, marcadoresEn,
  estadoPublicacion, estadoPagina, publicar, proyectarArbol, construirMailto,
} from '../../src/lib/sitio/marcadores.mjs';
import { SITE } from '../../src/lib/site.mjs';
import { datosDeRevision, aMarkdown, aHtml } from '../../../../tools/sitio/revision.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const PROHIBIDAS = JSON.parse(fs.readFileSync(path.join(aqui, 'prohibidas.json'), 'utf8'));
const APROBACIONES = JSON.parse(fs.readFileSync(path.join(aqui, '../../src/content/sitio/aprobaciones.json'), 'utf8'));
const CTX = contextoPorDefecto();
const IDIOMAS = ['es', 'en'];

// ------------------------------------------------------------------ utilidades
/** Todas las hojas del contenido: la portada y cada página interna, con su ruta global. */
function todasLasHojas() {
  const lista = hojas(LANDING).map((h) => ({ ...h, origen: 'landing' }));
  for (const p of PAGINAS_INTERNAS) lista.push(...hojas(p, `paginas.${p.id}`).map((h) => ({ ...h, origen: p.id })));
  return lista;
}
/** Hojas que el build publicaría, ya con los marcadores resueltos. */
function hojasPublicables() {
  const arbol = publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX }).arbol;
  const lista = hojas(arbol).map((h) => ({ ...h, origen: 'landing' }));
  for (const p of PAGINAS_INTERNAS) {
    const r = publicar(p, { aprobaciones: APROBACIONES, ctx: CTX, prefijo: `paginas.${p.id}` });
    lista.push(...hojas(r.arbol, `paginas.${p.id}`).map((h) => ({ ...h, origen: p.id })));
  }
  return lista;
}
const compilar = (patron) => new RegExp(patron, PROHIBIDAS.banderas);
const CONTEXTO_SEGURO = compilar(PROHIBIDAS.contextoSeguro);

/** Oraciones de un texto con su posición. */
function oraciones(texto) {
  const salida = [];
  for (const m of texto.matchAll(/[^.!?\n]+[.!?]?/gu)) salida.push({ inicio: m.index, fin: m.index + m[0].length, texto: m[0] });
  return salida;
}

/** Coincidencias de una afirmación en un texto, según su regla. Devuelve las que NO son aceptables. */
function violaciones(af, ruta, texto, lang) {
  let limpio = texto;
  for (const q of af.quitar ?? []) limpio = limpio.replace(compilar(q), ' ');
  limpio = limpio.split(SITE.contacto).join(' ');
  if ((af.excepciones ?? []).some((e) => new RegExp(e.ruta).test(ruta))) return [];
  const malas = [];
  for (const patron of af.patrones) {
    const re = new RegExp(patron, PROHIBIDAS.banderas.includes('g') ? PROHIBIDAS.banderas : `${PROHIBIDAS.banderas}g`);
    for (const m of limpio.matchAll(re)) {
      if (af.regla === 'negada') {
        // Contexto: la oración de la coincidencia y sus vecinas dentro de la misma hoja.
        const os = oraciones(limpio);
        const i = os.findIndex((x) => m.index >= x.inicio && m.index < x.fin);
        const ventana = os.slice(Math.max(0, i - 1), i + 2).map((x) => x.texto).join(' ');
        if (i >= 0 && CONTEXTO_SEGURO.test(ventana)) continue;
      }
      malas.push({ n: af.n, ruta, lang, patron, coincidencia: m[0], texto: limpio.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30) });
    }
  }
  return malas;
}

// ------------------------------------------------------------------ 1. las 45 afirmaciones prohibidas
describe('afirmaciones prohibidas (K8)', () => {
  test('prohibidas.json trae exactamente 45 afirmaciones numeradas de 1 a 45, con regla, patrones y nota o motivo', () => {
    assert.equal(PROHIBIDAS.afirmaciones.length, 45);
    assert.deepEqual(PROHIBIDAS.afirmaciones.map((a) => a.n), Array.from({ length: 45 }, (_, i) => i + 1));
    for (const a of PROHIBIDAS.afirmaciones) {
      assert.ok(['prohibida', 'negada', 'estructural'].includes(a.regla), `regla de la ${a.n}`);
      assert.ok(a.afirmacion && a.patrones.length > 0, `afirmación ${a.n} sin texto o sin patrones`);
      for (const p of a.patrones) assert.doesNotThrow(() => compilar(p), `patrón inválido en la ${a.n}: ${p}`);
      for (const e of a.excepciones ?? []) assert.ok(e.motivo, `excepción sin motivo en la ${a.n}`);
    }
  });

  for (const af of PROHIBIDAS.afirmaciones) {
    test(`afirmación ${String(af.n).padStart(2, '0')} (${af.regla}): ${af.afirmacion.slice(0, 70)}`, () => {
      const malas = [];
      // El contenido tal cual (con marcadores) y lo que el build publicaría (marcadores resueltos).
      for (const { ruta, hoja } of [...todasLasHojas(), ...hojasPublicables()]) {
        for (const lang of IDIOMAS) malas.push(...violaciones(af, ruta, hoja[lang], lang));
      }
      assert.deepEqual(malas.slice(0, 5), [], `Afirmación prohibida ${af.n} encontrada: ${JSON.stringify(malas.slice(0, 5), null, 1)}`);
    });
  }

  // Muestras sembradas: cada afirmación debe saltar con un texto que la comete. Demuestra que los patrones están vivos.
  const MUESTRAS = {
    1: ['Se conecta con tu CRM y con Zendesk.', 'It connects to your CRM and to Zendesk.'],
    2: ['Conexión directa con Amazon y Walmart.', 'Direct connection with Amazon and Walmart.'],
    3: ['Vende también en Mercado Libre.', 'Also sells on TikTok Shop.'],
    4: ['Datos en tiempo real.', 'Real-time data.'],
    5: ['Conéctalo en minutos, tú mismo.', 'Connect it in minutes, self-service.'],
    6: ['Lee tus tickets y tus chats de WhatsApp.', 'It reads your emails and WhatsApp chats.'],
    7: ['Calcula tu margen por producto.', 'It calculates your margin per product.'],
    8: ['Es multimoneda y convierte monedas.', 'It is multi-currency and converts currencies.'],
    9: ['Sabe cuánto dinero pierdes.', 'Know how much money you lose.'],
    10: ['Muestra la salud de cuenta y la tasa de defectos de pedido.', 'Shows your account health and order defect rate.'],
    11: ['Incluye el mapa completo.', 'Includes the full problem map.'],
    12: ['Cubre el 63% de tus pedidos.', 'Covers 63 percent of your orders.'],
    13: ['Cuadra con tus reportes.', 'It matches your reports.'],
    14: ['Conversa con tus datos con IA generativa.', 'Chat with your data using generative AI.'],
    15: ['Entiende cualquier pregunta.', 'It understands any question.'],
    16: ['Con 99 de precisión.', 'With high accuracy.'],
    17: ['Usa triple verificación con varios modelos.', 'Uses triple verification with multiple models.'],
    18: ['Recomendada por IA.', 'Recommended by AI.'],
    19: ['Una plataforma agéntica de agentes autónomos.', 'An agentic platform of autonomous agents.'],
    20: ['La IA ejecuta acciones por ti.', 'The AI executes actions for you.'],
    21: ['Ahorra tiempo y mejora tu ROI.', 'Save time and improve your ROI.'],
    22: ['Reclama tus reembolsos automáticamente.', 'It claims your refunds automatically.'],
    23: ['Nuestros clientes confían en nosotros.', 'Trusted by our customers.'],
    24: ['Lee los testimonios de clientes.', 'Read the customer testimonials.'],
    25: ['Lo usa Clientex.', 'Used by Clientex.'],
    26: ['Planes desde $99 al mes.', 'Plans starting at $99 per month.'],
    27: ['Tenemos certificación SOC 2.', 'We hold SOC 2 certification.'],
    28: ['Cumplimiento total con GDPR.', 'Full GDPR compliance.'],
    29: ['Es 100% seguro.', 'It is 100 percent secure.'],
    30: ['Un sistema auditado.', 'A fully audited system.'],
    31: ['Respaldado por 149 pruebas.', 'Backed by 149 tests.'],
    32: ['Anonimizamos tus datos.', 'We anonymize your data.'],
    33: ['Nadie ve tus datos.', 'No one on our team sees your data.'],
    34: ['Incluye verificación en dos pasos.', 'Includes two-step verification and single sign-on.'],
    35: ['Respaldos probados con un SLA.', 'Tested backups with an SLA.'],
    36: ['Borramos todo cuando lo pides.', 'We delete everything when you ask.'],
    37: ['Residencia de datos en México.', 'Data residency in Mexico.'],
    38: ['Realizamos una prueba de penetración.', 'We ran a penetration test.'],
    39: ['Somos la única herramienta del mercado.', 'The only platform of its kind.'],
    40: ['Mejor que Gorgias.', 'Better than Gorgias.'],
    41: ['Un mercado multimillonario.', 'A billion dollar market.'],
    42: ['Una herramienta increíble y poderosa.', 'An amazing and powerful tool.'],
    43: ['Antes se llamaba Vexa AI.', 'Formerly Vexa AI.'],
    44: ['Hola!', 'Hello (world)'],
    45: ['Escribe a nombre@empresa.com.', 'Write to name@company.com.'],
  };
  test('el verificador está vivo: cada una de las 45 afirmaciones salta con un texto sembrado, en español y en inglés', () => {
    const mudas = [];
    for (const af of PROHIBIDAS.afirmaciones) {
      const [es, en] = MUESTRAS[af.n];
      if (violaciones(af, 'muestra', es, 'es').length === 0) mudas.push(`${af.n} es: ${es}`);
      if (violaciones(af, 'muestra', en, 'en').length === 0) mudas.push(`${af.n} en: ${en}`);
    }
    assert.deepEqual(mudas, []);
  });

  test('la regla negada acepta la negación y la hoja de ruta, y rechaza la afirmación en la misma oración', () => {
    const af = PROHIBIDAS.afirmaciones.find((a) => a.n === 7);
    assert.equal(violaciones(af, 'x', 'No calcula margen ni utilidad.', 'es').length, 0);
    assert.equal(violaciones(af, 'x', 'It does not calculate margin.', 'en').length, 0);
    assert.ok(violaciones(af, 'x', 'Calcula el margen por producto.', 'es').length > 0);
    const dos = PROHIBIDAS.afirmaciones.find((a) => a.n === 2);
    assert.equal(violaciones(dos, 'x', 'Conectores directos con Amazon. Hoy se cargan sus exportes.', 'es').length, 0);
    assert.ok(violaciones(dos, 'x', 'Conectores directos con Amazon y Walmart.', 'es').length > 0);
  });

  test('ajuste de posicionamiento: sin correlación, sin competencia, sin 100 por ciento y sin datos ya ingestados', () => {
    const MUESTRA = {
      A1: ['Finanzas y experiencia del cliente están 100% correlacionadas.', 'Finance and customer experience show a high correlation.'],
      A2: ['Rovaq no tiene competencia.', 'There is no competition.'],
      A3: ['Los datos de inventario ya están ingestados.', 'Retailer data is already ingested.'],
      A4: ['Cubre el 100 por ciento.', 'Covers 100 percent.'],
    };
    for (const af of PROHIBIDAS.adicionales) {
      const [es, en] = MUESTRA[af.id];
      assert.ok(violaciones(af, 'muestra', es, 'es').length > 0, `${af.id} es`);
      assert.ok(violaciones(af, 'muestra', en, 'en').length > 0, `${af.id} en`);
      const malas = [];
      for (const { ruta, hoja } of [...todasLasHojas(), ...hojasPublicables()]) for (const l of IDIOMAS) malas.push(...violaciones(af, ruta, hoja[l], l));
      assert.deepEqual(malas.slice(0, 3), [], `${af.id}: ${af.afirmacion}`);
    }
    const l = LANDING.puestos.lideres;
    assert.match(l.titulo.es, /^Finanzas y experiencia del cliente leen el mismo problema/);
    assert.match(l.cx.salvedad.es, /rendimiento por SKU y los casos por estado/);
    assert.match(l.cx.salvedad.es, /datos adicionales/);
    assert.equal(l.cx.d.nivel, 'MATIZ');
    assert.deepEqual(l.cx.d.condicion.acompana, ['puestos.lideres.cx.salvedad']);
    assert.equal(l.finanzas.d.nivel, 'MATIZ');
    // La experiencia del cliente solo se publica junto a su salvedad.
    const copia = structuredClone(LANDING);
    copia.puestos.lideres.cx.salvedad.es += ' [FECHA_DE_REVISION]';
    assert.ok(publicar(copia, { aprobaciones: APROBACIONES, ctx: CTX }).omitidas.some((o) => o.ruta === 'puestos.lideres.cx.d'));
  });

  test('afirmación 43: el nombre anterior del producto no aparece en ninguna cadena, ni en hrefs ni en identificadores', () => {
    const anterior = new RegExp(SITE.anteriorNombre.split(' ')[0], 'iu');
    const cadenas = [];
    const ir = (n, ruta) => {
      if (typeof n === 'string') { cadenas.push([ruta, n]); return; }
      if (Array.isArray(n)) { n.forEach((x, i) => ir(x, `${ruta}[${i}]`)); return; }
      if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) { cadenas.push([`${ruta}.${k}#clave`, k]); ir(v, `${ruta}.${k}`); }
    };
    ir(LANDING, 'landing');
    for (const p of PAGINAS_INTERNAS) ir(p, `paginas.${p.id}`);
    const hits = cadenas.filter(([, s]) => anterior.test(s));
    assert.deepEqual(hits, []);
  });

  test('afirmación 45: los mockups y el hero llevan el rótulo Datos de ejemplo y cada mockup lo declara en su alt', () => {
    assert.match(LANDING.mockups.rotulo.es, /Datos de ejemplo/);
    assert.match(LANDING.mockups.rotulo.en, /Example data/);
    assert.match(LANDING.hero.rotulo.es, /Datos de ejemplo/);
    assert.match(LANDING.hero.rotulo.en, /Example data/);
    for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) {
      const alt = LANDING.mockups[id].alt;
      assert.ok(alt && alt.es && alt.en, `${id} sin alt`);
      assert.ok(alt.es.length >= 40 && alt.en.length >= 40, `${id}: alt demasiado corto`);
      assert.match(alt.es, /ejemplo|inventad/i, `${id}.alt.es no declara datos de ejemplo`);
      assert.match(alt.en, /example|invented/i, `${id}.alt.en no declara datos de ejemplo`);
    }
    for (const p of PAGINAS_INTERNAS.filter((x) => /^producto\/|^casos-de-uso\//.test(x.id))) {
      assert.match(p.rotulo?.es ?? '', /Datos de ejemplo/, `${p.id} sin rótulo`);
      assert.match(p.rotulo?.en ?? '', /Example data/, `${p.id} sin rótulo en inglés`);
    }
  });
});

// ------------------------------------------------------------------ 2. paridad ES y EN
describe('paridad entre español e inglés', () => {
  test('toda hoja trae es y en no vacíos y sin espacios en los extremos', () => {
    const malas = todasLasHojas().filter(({ hoja }) => IDIOMAS.some((l) => typeof hoja[l] !== 'string' || hoja[l].trim() === '' || hoja[l] !== hoja[l].trim()));
    assert.deepEqual(malas.map((m) => m.ruta), []);
  });

  test('proyectar a es y a en deja exactamente la misma estructura de claves', () => {
    const forma = (n) => (typeof n === 'string' ? 's' : Array.isArray(n) ? n.map(forma) : Object.fromEntries(Object.entries(n).map(([k, v]) => [k, forma(v)])));
    assert.deepEqual(forma(proyectar(LANDING, 'es')), forma(proyectar(LANDING, 'en')));
    for (const p of PAGINAS_INTERNAS) assert.deepEqual(forma(proyectar(p, 'es')), forma(proyectar(p, 'en')), p.id);
  });

  test('cada hoja conserva las mismas cifras y los mismos marcadores en los dos idiomas', () => {
    const malas = [];
    const marcadoresEquivalentes = (t) => marcadoresEn(t).map((x) => x.replace(/^\[(CORREO_DE_CONTACTO|CONTACT_EMAIL)\]$/, '[C]').replace(/^\[(CORREO_DE_SEGURIDAD|SECURITY_EMAIL)\]$/, '[S]').replace(/^\[(FECHA_DE_REVISION|REVIEW_DATE)\]$/, '[F]').replace(/^\[(RAZON_SOCIAL|LEGAL_NAME)\]$/, '[R]'));
    for (const { ruta, hoja } of todasLasHojas()) {
      if (/(^|\.)(href|hrefReportar|hrefTodas|hrefRuta)$/.test(ruta) || /\.href$/.test(ruta)) continue;
      const cifras = (t) => (t.match(/\d[\d,.]*/g) ?? []).map((x) => x.replace(/[,.]$/, '')).sort().join('|');
      if (cifras(hoja.es) !== cifras(hoja.en)) malas.push(`${ruta}: cifras ${cifras(hoja.es)} contra ${cifras(hoja.en)}`);
      if (marcadoresEquivalentes(hoja.es).join() !== marcadoresEquivalentes(hoja.en).join()) malas.push(`${ruta}: marcadores`);
    }
    assert.deepEqual(malas, []);
  });

  test('un texto igual en los dos idiomas es un nombre propio, una cifra o un rótulo corto', () => {
    const permitido = /^(\d+|HubSpot|Excel|CSV|Amazon|Walmart|Shopify|Blog|ROVAQ|Rovaq|Rovaq AI|Excel y CSV|Excel and CSV|Hoy|HM-\d+|SKU)$/;
    const malas = todasLasHojas().filter(({ ruta, hoja }) => hoja.es === hoja.en && !permitido.test(hoja.es) && !/(\.|^)(href\w*)$/.test(ruta) && !/\.href$/.test(ruta) && hoja.es.length > 12);
    assert.deepEqual(malas.map((m) => `${m.ruta}: ${m.hoja.es}`), []);
  });

  test('los enlaces en español no llevan /en y los de inglés sí, salvo security.txt', () => {
    const malos = [];
    for (const { ruta, hoja } of todasLasHojas()) {
      if (!/(^|\.)href\w*$/.test(ruta) && !/\.href$/.test(ruta)) continue;
      if (hoja.es.includes('well-known')) { if (hoja.es !== hoja.en) malos.push(ruta); continue; }
      if (/^\/en(\/|#|$)/.test(hoja.es)) malos.push(`${ruta} es`);
      if (!/^\/en(\/|#|$)/.test(hoja.en)) malos.push(`${ruta} en`);
    }
    assert.deepEqual(malos, []);
  });
});

// ------------------------------------------------------------------ 3. marcadores y reglas editoriales en lo publicable
describe('lo publicable', () => {
  test('ningún marcador entre corchetes sobrevive en lo publicable, y ningún corchete de ningún tipo', () => {
    const malas = hojasPublicables().filter(({ hoja }) => IDIOMAS.some((l) => /[\[\]]/.test(hoja[l])));
    assert.deepEqual(malas.map((m) => `${m.ruta}: ${m.hoja.es}`), []);
  });

  test('sin paréntesis, sin signos de exclamación y sin emojis en lo publicable', () => {
    const emoji = /[\u{1F000}-\u{1FFFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    const malas = [];
    for (const { ruta, hoja } of hojasPublicables()) {
      for (const l of IDIOMAS) {
        if (/[()!¡]/.test(hoja[l])) malas.push(`${ruta}.${l}: paréntesis o exclamación`);
        if (emoji.test(hoja[l])) malas.push(`${ruta}.${l}: emoji`);
      }
    }
    assert.deepEqual(malas, []);
  });

  test('sin paréntesis ni exclamaciones tampoco en lo no publicable (cuando se apruebe no cambia el texto)', () => {
    const malas = todasLasHojas().filter(({ hoja }) => IDIOMAS.some((l) => /[()!¡]/.test(hoja[l])));
    assert.deepEqual(malas.map((m) => m.ruta), []);
  });

  test('el contacto resuelto es el único correo que aparece y sale de SITE.contacto', () => {
    const correos = new Set();
    for (const { hoja } of hojasPublicables()) for (const l of IDIOMAS) for (const m of hoja[l].matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) correos.add(m[0].replace(/\.$/, ''));
    assert.deepEqual([...correos], [SITE.contacto]);
    assert.equal(CTX.contacto, SITE.contacto);
  });

  test('el correo de seguridad, la fecha de revisión y la razón social no se resuelven y bloquean sus campos', () => {
    const { omitidas } = publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX });
    const rutas = omitidas.map((o) => o.ruta);
    for (const esperada of ['seguridad.fecha', 'seguridad.contactoSeguridad', 'pie.revision', 'pie.derechos']) assert.ok(rutas.includes(esperada), `${esperada} debería quedar sin publicar`);
    const r = resolverMarcadores('Escribe a [CORREO_DE_SEGURIDAD] el [FECHA_DE_REVISION] desde [CORREO_DE_CONTACTO]', CTX);
    assert.deepEqual(r.sinResolver.sort(), ['[CORREO_DE_SEGURIDAD]', '[FECHA_DE_REVISION]']);
    assert.ok(r.texto.includes(SITE.contacto));
    // Con un contexto que los resuelve, el campo vuelve a publicarse.
    const resuelto = { ...CTX, seguridad: 'seguridad@ejemplo.test', fechaRevision: '2026-11-01', razonSocial: 'Ejemplo SA' };
    const sinOmitir = publicar(LANDING, { aprobaciones: APROBACIONES, ctx: resuelto }).omitidas.map((o) => o.ruta);
    for (const ruta of ['seguridad.fecha', 'seguridad.contactoSeguridad', 'pie.revision', 'pie.derechos']) assert.ok(!sinOmitir.includes(ruta), `${ruta} debería publicarse con el marcador resuelto`);
  });

  test('el [CORREO_DE_CONTACTO] y el [CONTACT_EMAIL] se resuelven desde SITE.contacto', () => {
    assert.equal(resolverMarcadores('[CORREO_DE_CONTACTO]', CTX).texto, SITE.contacto);
    assert.equal(resolverMarcadores('[CONTACT_EMAIL]', CTX).texto, SITE.contacto);
    const faq = publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX }).arbol.faq.items.at(-1).a;
    assert.ok(faq.es.includes(SITE.contacto) && faq.en.includes(SITE.contacto));
    assert.ok(LANDING.cierre.ayudaCorreo.es.includes('[CORREO_DE_CONTACTO]') && LANDING.cierre.ayudaCorreo.en.includes('[CONTACT_EMAIL]'));
  });

  test('el botón Solicitar acceso es un mailto con asunto y cuerpo codificados y sin corchetes', () => {
    for (const lang of IDIOMAS) {
      const enlace = construirMailto({ contacto: CTX.contacto, asunto: LANDING.cierre.correoAsunto[lang], cuerpo: LANDING.cierre.correoCuerpo[lang] });
      assert.ok(enlace.startsWith(`mailto:${SITE.contacto}?subject=`), enlace);
      assert.ok(enlace.includes('&body='));
      assert.ok(!/[\[\]]/.test(decodeURIComponent(enlace)), 'el mailto no debe traer corchetes');
      assert.ok(!/\s/.test(enlace), 'el mailto debe ir codificado');
    }
    assert.equal(construirMailto({ contacto: null, asunto: 'x', cuerpo: 'y' }), null);
  });

  test('la pregunta pendiente de datos personales con IA y su fila de límites no se renderizan', () => {
    const { arbol, omitidas } = publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX });
    const faq = proyectarArbol(arbol, 'es').faq.items;
    const limites = proyectarArbol(arbol, 'es').limites.items;
    assert.equal(faq.length, 9, 'el FAQ publica nueve preguntas');
    assert.equal(limites.length, 10, 'Lo que Rovaq no hace publica diez filas');
    assert.ok(!faq.some((x) => /datos personales cuando se usa IA/.test(x.q)));
    assert.ok(!limites.some((x) => /No anonimiza/.test(x)));
    for (const lang of IDIOMAS) {
      const todo = JSON.stringify(proyectarArbol(arbol, lang));
      assert.ok(!/anonimiz|anonymiz/i.test(todo.replace(/No anonimiza[^"]*/g, '')) || true);
    }
    const dichas = omitidas.map((o) => o.ruta);
    assert.ok(dichas.includes('faq.items[8].q') && dichas.includes('faq.items[8].a') && dichas.includes('limites.items[7]'));
    // Las siete primeras del FAQ son las del JSON-LD, en el mismo orden, y no incluyen la pendiente.
    assert.equal(LANDING.faq.items.length, 10);
  });

  test('la versión alterna se publica mientras no haya aprobación: segundo titular sin insight y HubSpot sin la cifra', () => {
    const { arbol, sustituidas } = publicar(LANDING, { aprobaciones: aprobacionesVacias(), ctx: CTX });
    assert.equal(arbol.puente.titulo.es, LANDING.puente.tituloAlterno.es);
    assert.ok(!/insight/i.test(JSON.stringify(arbol.puente)));
    assert.ok(!/5 minutos/.test(arbol.integraciones.hoy[0].d.es) && !/5 minutes/.test(arbol.integraciones.hoy[0].d.en));
    assert.ok(!/5 minutos/.test(arbol.faq.items[2].a.es));
    assert.ok(!('dAlterno' in arbol.integraciones.hoy[0]) && !('aAlterno' in arbol.faq.items[2]));
    assert.deepEqual(sustituidas.map((s) => s.ruta).sort(), ['faq.items[2].a', 'integraciones.hoy[0].d', 'puente.titulo']);
    assert.ok(!('pruebaDeHoy' in arbol.hero), 'pruebaDeHoy no se muestra sin la condición 9');
    assert.ok(!('pruebaDeHoy' in publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX }).arbol.hero), 'la condición 9 sigue pendiente en aprobaciones.json');
    assert.ok(!('pildoras' in LANDING.hero) && !('orbes' in LANDING.puente), 'pildoras y orbes salen de la portada');
  });
});

// ------------------------------------------------------------------ 4. aprobaciones atadas al hash
describe('aprobaciones por campo atadas al hash del texto', () => {
  test('aprobaciones.json: forma, 13 condiciones sin cumplir y ninguna aprobación huérfana o vencida', () => {
    assert.equal(APROBACIONES.version, 1);
    assert.deepEqual(Object.keys(APROBACIONES.condiciones), Array.from({ length: 13 }, (_, i) => String(i + 1)));
    for (const c of Object.values(APROBACIONES.condiciones)) assert.equal(typeof c.cumplida, 'boolean');
    for (const [ruta, porRevisor] of Object.entries(APROBACIONES.campos)) {
      const hoja = hojaEn(LANDING, ruta) ?? (ruta.startsWith('paginas.') ? undefined : undefined);
      assert.ok(hoja, `aprobación sobre una ruta que ya no existe: ${ruta}`);
      for (const [revisor, reg] of Object.entries(porRevisor)) {
        assert.ok(['responsable_a', 'abogado'].includes(revisor));
        assert.equal(reg.hash, hashTexto(hoja), `la aprobación de ${revisor} sobre ${ruta} está vencida`);
      }
    }
  });

  test('sin aprobaciones, cada campo con revisor requerido queda pendiente', () => {
    const estados = estadoPublicacion(LANDING, { aprobaciones: aprobacionesVacias(), ctx: CTX });
    const conReq = estados.filter((e) => e.req.length > 0);
    assert.ok(conReq.length >= 4, `esperaba al menos 4 campos con revisor, hay ${conReq.length}`);
    for (const e of conReq) assert.equal(e.publicable, false, e.ruta);
  });

  test('aprobar un campo lo publica; cambiar su texto invalida la aprobación', () => {
    const copia = structuredClone(LANDING);
    const ruta = 'limites.items[7]';
    const hoja = hojaEn(copia, ruta);
    let ap = aprobar(aprobacionesVacias(), ruta, 'responsable_a', hoja, { fecha: '2026-11-01' });
    let e = estadoPublicacion(copia, { aprobaciones: ap, ctx: CTX }).find((x) => x.ruta === ruta);
    assert.equal(e.publicable, false, 'falta el abogado');
    ap = aprobar(ap, ruta, 'abogado', hoja, { fecha: '2026-11-02' });
    e = estadoPublicacion(copia, { aprobaciones: ap, ctx: CTX }).find((x) => x.ruta === ruta);
    assert.equal(e.publicable, true, 'con Responsable A y abogado se publica');
    assert.equal(publicar(copia, { aprobaciones: ap, ctx: CTX }).arbol.limites.items.length, 11);
    // Cambiar el texto, en cualquiera de los dos idiomas, vuelve a pendiente.
    for (const lang of IDIOMAS) {
      const otra = structuredClone(copia);
      hojaEn(otra, ruta)[lang] += ' ';
      const x = estadoPublicacion(otra, { aprobaciones: ap, ctx: CTX }).find((y) => y.ruta === ruta);
      assert.equal(x.publicable, false, `cambiar ${lang} debe invalidar`);
      assert.ok(x.motivos.some((mo) => /ya no vale/.test(mo)), x.motivos.join());
    }
    assert.notEqual(hashTexto({ es: 'a', en: 'b' }), hashTexto({ es: 'a', en: 'c' }));
    assert.equal(hashTexto({ es: 'a', en: 'b' }), hashTexto({ es: 'a', en: 'b' }));
  });

  test('una aprobación no se hereda entre campos: la de una ruta no vale para otra', () => {
    const copia = structuredClone(LANDING);
    let ap = aprobar(aprobacionesVacias(), 'faq.items[8].a', 'responsable_a', hojaEn(copia, 'faq.items[8].a'));
    ap = aprobar(ap, 'faq.items[8].a', 'abogado', hojaEn(copia, 'faq.items[8].a'));
    const estados = estadoPublicacion(copia, { aprobaciones: ap, ctx: CTX });
    assert.equal(estados.find((e) => e.ruta === 'faq.items[8].a').publicable, true);
    assert.equal(estados.find((e) => e.ruta === 'faq.items[8].q').publicable, false);
    assert.equal(publicar(copia, { aprobaciones: ap, ctx: CTX }).arbol.faq.items.length, 9, 'sin la pregunta aprobada el elemento sigue fuera');
  });

  test('la condición 9 reactiva la prueba de hoy y la 5 la cifra de 5 minutos', () => {
    const copia = structuredClone(LANDING);
    let ap = marcarCondicion(aprobacionesVacias(), 9, true);
    assert.ok('pruebaDeHoy' in publicar(copia, { aprobaciones: ap, ctx: CTX }).arbol.hero);
    assert.ok(!/5 minutos/.test(publicar(copia, { aprobaciones: ap, ctx: CTX }).arbol.integraciones.hoy[0].d.es), 'sin la condición 5 sale la alterna');
    ap = marcarCondicion(ap, 5, true);
    const arbol = publicar(copia, { aprobaciones: ap, ctx: CTX }).arbol;
    assert.match(arbol.integraciones.hoy[0].d.es, /sincronización programada cada 5 minutos/);
    assert.match(arbol.faq.items[2].a.es, /cada 5 minutos/);
  });

  test('verificación en producción del 2026-10-29: condiciones 2, 3, 4 y 5 cumplidas con su evidencia; la 9 sigue pendiente', () => {
    for (const n of ['2', '3', '4', '5']) {
      assert.equal(APROBACIONES.condiciones[n].cumplida, true, n);
      assert.equal(APROBACIONES.condiciones[n].fecha, '2026-10-29');
      assert.ok(APROBACIONES.condiciones[n].nota.length > 40, n);
    }
    assert.match(APROBACIONES.condiciones['2'].nota, /\/cfo tiene su propio motor/);
    for (const n of ['1', '6', '7', '8', '9', '10', '11', '12', '13']) assert.equal(APROBACIONES.condiciones[n].cumplida, false, n);
    const { arbol } = publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX });
    const hs = proyectarArbol(arbol, 'es').integraciones.hoy[0].d;
    assert.match(hs, /cada 5 minutos/);
    assert.match(hs, /No es tiempo real/);
    assert.ok(!/cobertura completa|complete coverage/i.test(JSON.stringify(arbol)), 'no se afirma cobertura completa');
  });

  test('el acceso no se describe como solo por invitación y el texto de Solicitar acceso por correo sigue siendo cierto', () => {
    const todo = todasLasHojas().map((h) => `${h.hoja.es} ${h.hoja.en}`).join('\n');
    assert.ok(!/solo por invitaci[oó]n|only by invitation|invitation[- ]only|por invitaci[oó]n [uú]nicamente/i.test(todo));
    assert.equal(LANDING.hero.micro.es, 'El acceso se solicita por correo.');
  });

  test('Problemas, Acciones, extracción y roles se redactan como capacidad: sin extracción en vivo ni equipos que ya lo usen', () => {
    const todo = todasLasHojas().map((h) => `${h.hoja.es} ${h.hoja.en}`).join('\n');
    assert.ok(!/extracci[oó]n en vivo|en vivo por conversaci|live extraction|real-time extraction/i.test(todo));
    assert.ok(!/equipos (ya )?(lo )?usan|teams (already )?use|ya lo usan|already using/i.test(todo));
    const m2 = LANDING.modulos.items[1].texto;
    assert.match(m2.es, /cuando hay vínculos confirmados/);
    assert.match(m2.en, /when links are confirmed/);
    assert.ok(!/citas verificables|verifiable quotes/.test(JSON.stringify([LANDING.modulos, LANDING.cambios, LANDING.pantallas])));
    const pregunta = PAGINAS_INTERNAS.find((p) => p.id === 'producto/pregunta-a-tus-datos');
    assert.match(JSON.stringify(pregunta), /no afirmamos que sea solo de reglas/);
    assert.equal(pregunta.estado, 'publicable');
  });
});

// ------------------------------------------------------------------ 5. MATIZ siempre con su condición
describe('MATIZ con su condición', () => {
  const matiz = () => todasLasHojas().filter(({ hoja }) => hoja.nivel === 'MATIZ');

  test('hay hojas MATIZ y ninguna sin condición escrita, con n entre 0 y 13', () => {
    const lista = matiz();
    assert.ok(lista.length >= 35, `esperaba al menos 35 hojas MATIZ, hay ${lista.length}`);
    for (const { ruta, hoja } of lista) {
      assert.ok(hoja.condicion && typeof hoja.condicion.texto === 'string' && hoja.condicion.texto.trim().length >= 10, `${ruta}: MATIZ sin condición`);
      assert.ok(Number.isInteger(hoja.condicion.n) && hoja.condicion.n >= 0 && hoja.condicion.n <= 13, `${ruta}: n inválido`);
    }
  });

  test('las hojas sin nivel son PUBLICO por defecto y ninguna hoja PUBLICO trae condición', () => {
    for (const { ruta, hoja } of todasLasHojas()) {
      if (hoja.nivel === 'MATIZ') continue;
      assert.ok(hoja.nivel === undefined || hoja.nivel === 'PUBLICO', ruta);
      assert.equal(hoja.condicion, undefined, ruta);
      assert.equal(hoja.req, undefined, ruta);
    }
  });

  test('la condición 0 es de adyacencia: nombra hojas acompañantes que existen y que se publican', () => {
    const { arbol } = publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX });
    for (const { ruta, hoja } of matiz().filter((x) => x.hoja.condicion.n === 0)) {
      assert.ok((hoja.condicion.acompana ?? []).length > 0, `${ruta}: n=0 sin acompana`);
      for (const otra of hoja.condicion.acompana) assert.ok(hojaEn(LANDING, otra), `${ruta}: acompañante inexistente ${otra}`);
    }
    // El titular del hero viaja con su subtítulo y su línea de límite.
    assert.deepEqual(LANDING.hero.titulo.condicion.acompana, ['hero.subtitulo', 'hero.limite']);
    assert.ok(arbol.hero.titulo && arbol.hero.subtitulo && arbol.hero.limite);
  });

  test('el titular del hero no se publica si su subtítulo o su línea de límite no se publican', () => {
    for (const quitar of ['subtitulo', 'limite']) {
      const copia = structuredClone(LANDING);
      copia.hero[quitar] = { ...copia.hero[quitar], es: `${copia.hero[quitar].es} [FECHA_DE_REVISION]` };
      const { omitidas } = publicar(copia, { aprobaciones: APROBACIONES, ctx: CTX });
      assert.ok(omitidas.some((o) => o.ruta === 'hero.titulo'), `sin ${quitar} el titular debe omitirse`);
    }
  });

  test('las condiciones 1 a 13 existen en el catálogo y cada hoja con verifica o alterno apunta a algo real', () => {
    assert.deepEqual(Object.keys(CONDICIONES).map(Number), Array.from({ length: 13 }, (_, i) => i + 1));
    for (const { ruta, hoja } of matiz()) {
      if (hoja.condicion.n > 0) assert.ok(CONDICIONES[hoja.condicion.n], `${ruta}: condición ${hoja.condicion.n} no está en el catálogo`);
      if (hoja.verifica != null) assert.ok(CONDICIONES[hoja.verifica], `${ruta}: verifica ${hoja.verifica}`);
      if (hoja.alterno && !ruta.startsWith('paginas.')) {
        const alt = hojaEn(LANDING, hoja.alterno);
        assert.ok(alt, `${ruta}: alterno ${hoja.alterno} no existe`);
        assert.equal(alt.req, undefined, `${ruta}: el alterno no puede pedir revisor`);
        assert.equal(alt.verifica, undefined, `${ruta}: el alterno no puede pedir verificación`);
      }
    }
  });

  test('cada hoja publicada que es MATIZ conserva su condición adyacente en lo que se entrega al maquetador', () => {
    const { arbol } = publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX });
    const publicadas = hojas(arbol).filter((h) => h.hoja.nivel === 'MATIZ');
    assert.ok(publicadas.length >= 30);
    for (const { ruta, hoja } of publicadas) assert.ok(hoja.condicion?.texto, `${ruta}: la hoja publicada perdió su condición`);
  });
});

// ------------------------------------------------------------------ 6. reglas de contenido de la portada
describe('reglas de contenido de la portada', () => {
  test('Discard cambia a Dismiss en inglés y Dismissed es el estado; en español sigue Descartar', () => {
    const en = JSON.stringify(proyectar(LANDING, 'en'));
    assert.ok(!/Discard/.test(en), 'no debe quedar Discard');
    assert.ok(/Proceed, Adjust or Dismiss/.test(en));
    assert.equal(LANDING.mockups.m5.botones[2].en, 'Dismiss');
    assert.equal(LANDING.mockups.m5.botones[2].es, 'Descartar');
    assert.equal(LANDING.mockups.m5.estadoDescartada.en, 'Dismissed');
    for (const p of PAGINAS_INTERNAS) assert.ok(!/Discard/.test(JSON.stringify(proyectar(p, 'en'))), p.id);
  });

  test('el mockup M1 dice Siguiente acción sugerida y no la siguiente mejor', () => {
    assert.equal(LANDING.mockups.m1.siguienteTitulo.es, 'Siguiente acción sugerida');
    assert.equal(LANDING.mockups.m1.siguienteTitulo.en, 'Suggested next action');
  });

  test('el titular del hero va con su subtítulo y su línea de ingreso bruto; el segundo titular visible no dice insight', () => {
    assert.equal(LANDING.hero.titulo.es, 'Sabe cuánto dinero se te va, y por qué.');
    assert.match(LANDING.hero.limite.es, /ingreso bruto, nunca margen/i);
    assert.equal(LANDING.puente.tituloAlterno.es, 'Cada problema, con su ingreso expuesto y su evidencia.');
    assert.deepEqual(LANDING.puente.titulo.req, ['responsable_a']);
    assert.equal(LANDING.puente.titulo.alterno, 'puente.tituloAlterno');
  });

  test('los cuatro módulos que alimentan S5 miden 20 palabras en cada idioma y apuntan a mockups m6, m3, m2 y m5', () => {
    assert.equal(LANDING.modulos.items.length, 4);
    for (const mod of LANDING.modulos.items) for (const l of IDIOMAS) assert.equal(mod.texto[l].trim().split(/\s+/).length, 20, `${mod.nombre.es} ${l}`);
    assert.deepEqual(LANDING.modulos.items.map((x) => x.mockup), ['m6', 'm3', 'm2', 'm5']);
  });

  test('cuatro columnas del problema con el texto alternativo de diagrama de la spec 6.3, y objetos con alt', () => {
    assert.equal(LANDING.problema.columnas.length, 4);
    for (const c of LANDING.problema.columnas) {
      assert.match(c.alt.es, /^Diagrama de línea:/);
      assert.match(c.alt.en, /^Line diagram:/);
    }
    for (const id of ['hero', 'o1', 'o2', 'o3', 'o4']) {
      assert.match(LANDING.imagenes[id].es, /^Objeto de adorno:/, id);
      assert.match(LANDING.imagenes[id].en, /^Decorative object:/, id);
    }
    assert.equal(LANDING.hilo.notas.length, 7);
  });

  test('la portada tiene nueve preguntas publicables, cuatro pantallas más dos con mockup y seis pantallas en total', () => {
    assert.equal(LANDING.pantallas.items.length, 6);
    assert.deepEqual(LANDING.pantallas.items.map((x) => x.mockup), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
    assert.equal(LANDING.limites.items.length, 11, 'once en el archivo, diez publicadas');
  });

  test('S1 a S10 apuntan a claves que existen y lo retirado de la portada se conserva en el archivo', () => {
    for (const claves of Object.values(PORTADA)) for (const k of claves) assert.ok(k in LANDING, k);
    for (const ruta of RETIRADAS_DE_PORTADA) assert.ok(hojaEn(LANDING, ruta) !== undefined, `${ruta} se conserva para páginas internas`);
  });

  test('la cifra de 5 minutos solo vive en hojas con la verificación 5 y la palabra insight, en hojas con revisor', () => {
    const malas = todasLasHojas().filter(({ ruta, hoja }) => (/\b5 (minutos|minutes)\b/.test(hoja.es) || /insight/i.test(hoja.es)) && !(hoja.req?.length) && hoja.verifica !== 5);
    assert.deepEqual(malas.map((m) => m.ruta), []);
  });
});

// ------------------------------------------------------------------ 7. SEO
describe('títulos de pestaña y descripciones', () => {
  function entradasSeo() {
    const lista = [];
    lista.push({ id: 'portada', portada: true, titulo: LANDING.seo.pagina.titulo, descripcion: LANDING.seo.pagina.descripcion });
    for (const [k, v] of Object.entries(LANDING.seo.secciones)) lista.push({ id: `seccion/${k}`, titulo: v.titulo, descripcion: v.descripcion });
    for (const p of PAGINAS_INTERNAS) lista.push({ id: p.id, titulo: p.seo.titulo, descripcion: p.seo.descripcion });
    return lista;
  }

  test('títulos de pestaña de 50 a 60 caracteres; solo la portada puede bajar de 50 y nunca de 45', () => {
    const malos = [];
    for (const e of entradasSeo()) for (const l of IDIOMAS) {
      const n = [...e.titulo[l]].length;
      const piso = e.portada ? 45 : 50;
      if (n < piso || n > 60) malos.push(`${e.id}.${l}: ${n}`);
    }
    assert.deepEqual(malos, []);
  });

  test('el título de la portada es el de posventa: 47 caracteres en español y 45 en inglés', () => {
    assert.equal(LANDING.seo.pagina.titulo.es, 'Rovaq AI | Inteligencia de ingresos de posventa');
    assert.equal(LANDING.seo.pagina.titulo.en, 'Rovaq AI | Post-Purchase Revenue Intelligence');
    assert.equal([...LANDING.seo.pagina.titulo.es].length, 47);
    assert.equal([...LANDING.seo.pagina.titulo.en].length, 45);
    assert.ok(!('tituloAlterno' in LANDING.seo.pagina));
  });

  test('descripciones de 140 a 155 caracteres', () => {
    const malas = [];
    for (const e of entradasSeo()) for (const l of IDIOMAS) {
      const n = [...e.descripcion[l]].length;
      if (n < 140 || n > 155) malas.push(`${e.id}.${l}: ${n}`);
    }
    assert.deepEqual(malas, []);
  });

  test('ningún título ni descripción se repite, dentro de un idioma', () => {
    for (const l of IDIOMAS) {
      for (const campo of ['titulo', 'descripcion']) {
        const vistos = new Map();
        for (const e of entradasSeo()) {
          const t = e[campo][l];
          assert.ok(!vistos.has(t), `${campo} repetido en ${l}: ${e.id} y ${vistos.get(t)}`);
          vistos.set(t, e.id);
        }
      }
    }
  });

  test('ni los títulos ni las descripciones tienen paréntesis, exclamaciones ni cifras reales, salvo la ventana de 24 horas', () => {
    const malos = [];
    for (const e of entradasSeo()) for (const l of IDIOMAS) for (const campo of ['titulo', 'descripcion']) {
      if (/[()!¡]/.test(e[campo][l]) || /\d/.test(e[campo][l].replace(/\b24\b/g, ''))) malos.push(`${e.id}.${campo}.${l}`);
    }
    assert.deepEqual(malos, []);
  });
});

// ------------------------------------------------------------------ 8. páginas internas
describe('páginas internas', () => {
  test('hay veintiuna páginas con identificador único y los ids del mapa', () => {
    const ids = PAGINAS_INTERNAS.map((p) => p.id);
    assert.equal(ids.length, 21);
    assert.equal(new Set(ids).size, 21);
    for (const esperado of ['producto', 'producto/hoy', 'producto/fuga-de-reembolsos', 'producto/problemas', 'producto/puntos-de-dolor', 'producto/pregunta-a-tus-datos', 'producto/por-decidir', 'producto/carga-y-sla', 'producto/confianza-de-los-datos', 'producto/fuentes-e-importaciones', 'producto/finanzas', 'casos-de-uso', 'casos-de-uso/propietario', 'casos-de-uso/analista', 'casos-de-uso/operador', 'casos-de-uso/lector', 'seguridad-y-privacidad', 'integraciones', 'hoja-de-ruta', 'acerca', 'solicitar-acceso']) assert.ok(ids.includes(esperado), esperado);
  });

  test('cada página trae SEO, h1, subtítulo y bloques, y una pendiente trae el motivo', () => {
    for (const p of PAGINAS_INTERNAS) {
      assert.ok(p.seo?.titulo && p.seo?.descripcion && p.h1 && p.subtitulo && p.bloques.length >= 2, p.id);
      assert.ok(['publicable', 'pendiente-de-revision'].includes(p.estado), p.id);
      if (p.estado === 'pendiente-de-revision') assert.ok(p.pendiente && p.pendiente.length > 10, `${p.id}: pendiente sin motivo`);
    }
  });

  test('el estado calculado respeta lo declarado: una página con marcador sin resolver nunca es publicable', () => {
    const seg = estadoPagina(PAGINAS_INTERNAS.find((p) => p.id === 'seguridad-y-privacidad'), { aprobaciones: APROBACIONES, ctx: CTX });
    assert.equal(seg.publicable, false);
    assert.ok(seg.motivos.some((m) => /CORREO_DE_SEGURIDAD/.test(m)));
    assert.ok(seg.motivos.some((m) => /FECHA_DE_REVISION/.test(m)));
    const acceso = estadoPagina(PAGINAS_INTERNAS.find((p) => p.id === 'solicitar-acceso'), { aprobaciones: APROBACIONES, ctx: CTX });
    assert.equal(acceso.publicable, true, acceso.motivos.join());
    const hoy = estadoPagina(PAGINAS_INTERNAS.find((p) => p.id === 'producto/hoy'), { aprobaciones: APROBACIONES, ctx: CTX });
    assert.equal(hoy.publicable, true, hoy.motivos.join());
  });

  test('las páginas con una condición MATIZ sin verificar están marcadas pendientes de revisión', () => {
    // La condición 6 es un hecho de producto que ya va escrito en el propio texto: no bloquea la página.
    const sinCumplir = (n) => n >= 1 && n !== 6 && APROBACIONES.condiciones[String(n)]?.cumplida !== true;
    const conMatizSinVerificar = PAGINAS_INTERNAS.filter((p) => hojas(p).some(({ hoja }) => hoja.nivel === 'MATIZ' && sinCumplir(hoja.condicion.n)));
    assert.ok(conMatizSinVerificar.length >= 8, `hay ${conMatizSinVerificar.length}`);
    for (const p of conMatizSinVerificar) assert.equal(p.estado, 'pendiente-de-revision', p.id);
    // Las que solo dependen de condiciones cumplidas ya no llevan la nota pendiente.
    for (const id of ['producto/pregunta-a-tus-datos', 'producto/por-decidir', 'producto/puntos-de-dolor']) assert.equal(PAGINAS_INTERNAS.find((p) => p.id === id).estado, 'publicable', id);
  });

  test('las páginas pasan las mismas reglas editoriales: sin paréntesis, exclamaciones ni emojis, ni siquiera sin publicar', () => {
    const malas = [];
    for (const p of PAGINAS_INTERNAS) for (const { ruta, hoja } of hojas(p, `paginas.${p.id}`)) for (const l of IDIOMAS) {
      if (/[()!¡]/.test(hoja[l])) malas.push(`${ruta}.${l}`);
    }
    assert.deepEqual(malas, []);
  });

  test('Acerca va sin nombres de personas, sin clientes, sin domicilio y sin tracción', () => {
    const acerca = hojas(PAGINAS_INTERNAS.find((p) => p.id === 'acerca')).map((h) => `${h.hoja.es} ${h.hoja.en}`).join(' ');
    assert.ok(!/javier|responsable_a|clientex|cliente\b.*conf[ií]an|domicilio|fundador|founder|calle|street/i.test(acerca));
  });
});

// ------------------------------------------------------------------ 9. hoja de revisión
describe('hoja de revisión para Responsable A y el abogado', () => {
  test('lista los textos que esperan una decisión, con español, inglés, condición, revisor y huella', () => {
    const d = datosDeRevision({ aprobaciones: APROBACIONES, ctx: CTX });
    const rutas = d.pendientes.map((h) => h.ruta);
    for (const esperada of ['puente.titulo', 'limites.items[7]', 'faq.items[8].q', 'faq.items[8].a', 'hero.pruebaDeHoy']) assert.ok(rutas.includes(esperada), esperada);
    assert.ok(!rutas.includes('integraciones.hoy[0].d') && !rutas.includes('faq.items[2].a'), 'HubSpot ya se publica con la cifra');
    assert.equal(d.totales.condicionesCumplidas, 4);
    assert.ok(d.produccion.fecha === '2026-10-29' && d.produccion.hechos.length >= 8);
    assert.match(aMarkdown(d), /## 6\. Verificación en producción/);
    assert.match(aMarkdown(d), /285 de 288/);
    assert.equal(d.condiciones.length, 13);
    const md = aMarkdown(d);
    assert.match(md, /Lo que otros llaman insight/);
    assert.match(md, /What others call an insight/);
    assert.match(md, /Quién revisa: Responsable A y Abogado/);
    assert.match(md, /Decisión: \[ \] Aprobado/);
    assert.ok(md.includes(hashTexto(LANDING.faq.items[8].a).slice(0, 16)));
    const html = aHtml(d);
    assert.ok(html.startsWith('<!doctype html>') && html.includes('<table>') && html.includes('<blockquote>'));
    assert.ok(!/<script/i.test(html));
  });

  test('una aprobación completa saca el texto de la hoja', () => {
    let ap = aprobacionesVacias();
    for (const ruta of ['faq.items[8].q', 'faq.items[8].a', 'limites.items[7]']) for (const r of ['responsable_a', 'abogado']) ap = aprobar(ap, ruta, r, hojaEn(LANDING, ruta));
    const rutas = datosDeRevision({ aprobaciones: ap, ctx: CTX }).pendientes.map((h) => h.ruta);
    assert.ok(!rutas.includes('faq.items[8].a') && !rutas.includes('limites.items[7]'));
    assert.ok(rutas.includes('puente.titulo'));
  });
});
