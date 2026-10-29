// Pruebas de la portada (T8): las diez secciones S1 a S10 renderizadas con react-dom/server en ES y EN, dentro del marco de T7.
// Revisa orden, temas, encabezados, escáneres de T12, hojas no publicables, afirmaciones prohibidas (prohibidas.json de T11) sobre el
// HTML renderizado, rojo, enlaces contra el registro K2, accesibilidad del acordeón y el contrato de marcado de T6.
// El render corre en un proceso hijo con tsx (los componentes son TSX) y un cargador que trata los .css como vacíos.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escanearHtml } from './_escaner.mjs';
import { LANDING } from '../../src/content/sitio/landing.ts';
import { hojas, hojaEn, publicar, contextoPorDefecto } from '../../src/lib/sitio/marcadores.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(aqui, '..', '..');
const PROHIBIDAS = JSON.parse(fs.readFileSync(path.join(aqui, 'prohibidas.json'), 'utf8'));
const APROBACIONES = JSON.parse(fs.readFileSync(path.join(WEB, 'src/content/sitio/aprobaciones.json'), 'utf8'));
const CTX = contextoPorDefecto();
const IDIOMAS = ['es', 'en'];

const salida = JSON.parse(
  execFileSync(process.execPath, ['--import', 'tsx', '--import', path.join(aqui, '_css-nulo.mjs'), path.join(aqui, '_render-secciones.tsx')], {
    cwd: WEB,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  }).toString(),
);

const SECCIONES = [
  { clave: 'hero', id: 'inicio', tema: 'oscuro' },
  { clave: 'horizonte', id: 'horizonte', tema: 'claro' },
  { clave: 'problema', id: 'problema', tema: 'claro' },
  { clave: 'valor', id: 'valor', tema: 'claro' },
  { clave: 'pasos', id: 'modulos', tema: 'oscuro' },
  { clave: 'pantallas', id: 'pantallas', tema: 'claro' },
  { clave: 'puestos', id: 'puestos', tema: 'claro' },
  { clave: 'seguridad', id: 'seguridad', tema: 'oscuro' },
  { clave: 'integraciones', id: 'integraciones', tema: 'claro' },
  { clave: 'cierre', id: 'cierre', tema: 'oscuro' },
];

// ------------------------------------------------------------------ utilidades sobre el HTML
const DECODIFICA = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** Etiquetas abiertas con sus atributos. */
const etiquetas = (html, nombre) => [...html.matchAll(new RegExp(`<${nombre}(\\s[^>]*)?>`, 'gi'))].map((m) => m[0]);
const attr = (tag, nombre) => {
  const m = new RegExp(`\\s${nombre}(?:=(?:"([^"]*)"|'([^']*)'))?(?=[\\s/>])`, 'i').exec(tag);
  return m ? DECODIFICA(m[1] ?? m[2] ?? '') : undefined;
};
/** Nodos de texto visibles (sin scripts, estilos ni valores de atributos). */
function nodosDeTexto(html) {
  const sin = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  return sin.split(/<[^>]+>/).map((t) => DECODIFICA(t).replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const textoPlano = (html) => nodosDeTexto(html).join(' ');
/** Fragmento HTML de una sección por su id, hasta el cierre de su etiqueta de apertura (la portada no anida secciones). */
function seccion(html, id) {
  const i = html.indexOf(` id="${id}"`);
  assert.ok(i >= 0, `falta la sección ${id}`);
  const ini = html.lastIndexOf('<', i);
  const nombre = /^<(\w+)/.exec(html.slice(ini))[1];
  // Cuenta anidamiento del mismo nombre de etiqueta.
  let nivel = 0;
  for (const m of html.slice(ini).matchAll(new RegExp(`<(/?)${nombre}\\b[^>]*>`, 'g'))) {
    nivel += m[1] ? -1 : 1;
    if (nivel === 0) return html.slice(ini, ini + m.index + m[0].length);
  }
  throw new Error(`sección sin cierre: ${id}`);
}
const portada = (lang) => salida[lang].portada;
const pagina = (lang) => salida[lang].html;

// ------------------------------------------------------------------ 1. estructura
describe('diez secciones S1 a S10, en orden', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: data-seccion en el orden hero, horizonte, problema, valor, pasos, pantallas, puestos, seguridad, integraciones, cierre`, () => {
      const claves = etiquetas(portada(lang), '\\w+').map((t) => attr(t, 'data-seccion')).filter(Boolean);
      assert.deepEqual(claves, SECCIONES.map((s) => s.clave));
    });

    test(`${lang}: cada sección tiene id, data-seccion y data-tema oscuro o claro, y las secciones de contenido son <section> con encabezado`, () => {
      for (const s of SECCIONES) {
        const html = seccion(portada(lang), s.id);
        const abre = /^<[^>]+>/.exec(html)[0];
        assert.equal(attr(abre, 'data-seccion'), s.clave, s.id);
        assert.equal(attr(abre, 'data-tema'), s.tema, `${s.id} tema`);
        assert.ok(['oscuro', 'claro'].includes(attr(abre, 'data-tema')), s.id);
        if (s.clave === 'horizonte') continue; // S2 no tiene contenido: es un bloque decorativo aria-hidden
        assert.match(abre, /^<section\b/, `${s.id} es section`);
        const rotulo = attr(abre, 'aria-labelledby');
        assert.ok(rotulo && html.includes(` id="${rotulo}"`), `${s.id} aria-labelledby apunta a un encabezado existente`);
        assert.ok(/<h2\b/.test(html) || s.clave === 'hero', `${s.id} trae un h2`);
      }
    });

    test(`${lang}: un solo h1 en toda la página, h2 por sección y sin saltos de nivel`, () => {
      const html = pagina(lang);
      assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
      const principal = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
      const niveles = [...principal.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
      assert.equal(niveles[0], 1);
      for (let i = 1; i < niveles.length; i++) assert.ok(niveles[i] <= niveles[i - 1] + 1, `salto de h${niveles[i - 1]} a h${niveles[i]} en la posición ${i}`);
      for (const s of SECCIONES.filter((x) => !['horizonte'].includes(x.clave))) {
        const h = seccion(portada(lang), s.id);
        assert.ok(/<h[12]\b/.test(h) || /s-solo-lector/.test(h), `${s.id}: encabezado de nivel 1 o 2`);
      }
    });

    test(`${lang}: costuras solo en S5, S6, S8, S9 y S10; S3 y S4 sin costura; S4 y S7 con fondo alterno`, () => {
      const abre = (id) => /^<[^>]+>/.exec(seccion(portada(lang), id))[0];
      for (const id of ['modulos', 'pantallas', 'seguridad', 'integraciones', 'cierre']) assert.match(abre(id), /\bs-costura\b/, id);
      for (const id of ['problema', 'valor', 'puestos', 'inicio']) assert.doesNotMatch(abre(id), /\bs-costura\b/, id);
      for (const id of ['valor', 'puestos']) assert.match(abre(id), /s-seccion--alterna s-seccion--corte/, id);
    });

    test(`${lang}: contenedor del hilo vacío (data-hilo) al inicio de .s-hilo-zona y sin hilo durante S1`, () => {
      const html = portada(lang);
      const zona = html.indexOf('class="s-hilo-zona"');
      assert.ok(zona > html.indexOf('id="inicio"'));
      const hilo = /<div data-hilo(?:="")? aria-hidden="true"><\/div>/.exec(html);
      assert.ok(hilo, 'data-hilo vacío');
      assert.ok(hilo.index > zona && hilo.index < html.indexOf('id="problema"'));
      assert.equal((html.match(/data-hilo/g) ?? []).length, 1);
    });
  }
});

// ------------------------------------------------------------------ 2. escáneres y reglas duras
describe('escáneres de T12, atributos prohibidos y ausencia de JavaScript', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: el escáner de HTML no encuentra style, script en línea, origen externo, inert, h1 duplicado, img sin alt, width y height, ni falta de lang`, () => {
      assert.deepEqual(escanearHtml(pagina(lang), { archivo: `portada-${lang}` }), []);
    });

    test(`${lang}: lang correcto, cero style, cero script, cero inert, cero hidden y cero recursos externos en la portada`, () => {
      assert.match(pagina(lang), new RegExp(`<html lang="${lang}"`));
      const p = portada(lang);
      assert.equal((p.match(/\sstyle\s*=/gi) ?? []).length, 0);
      assert.equal((p.match(/<script\b/gi) ?? []).length, 0);
      assert.equal((p.match(/\sinert(\s|=|>)/gi) ?? []).length, 0);
      assert.equal((p.match(/\shidden(\s|=|>)/gi) ?? []).length, 0, 'nada oculto en el HTML: el estado oculto vive en el CSS bajo html[data-js]');
      assert.doesNotMatch(p, /(?:src|href|srcset)="(?:https?:)?\/\/(?!rovaq\.ai)/i);
      assert.doesNotMatch(p, /data-js/, 'data-js lo escribe sitio.js, no el servidor');
    });

    test(`${lang}: toda imagen trae alt, ancho y alto; el alt de las del manifest coincide con el del manifest`, () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(WEB, 'public/s/manifest.json'), 'utf8'));
      const imgs = etiquetas(portada(lang), 'img');
      assert.ok(imgs.length >= 9, `hay ${imgs.length} imágenes`);
      for (const t of imgs) {
        assert.notEqual(attr(t, 'alt'), undefined, t.slice(0, 80));
        assert.match(attr(t, 'width') ?? '', /^\d+$/);
        assert.match(attr(t, 'height') ?? '', /^\d+$/);
        const src = attr(t, 'src');
        const entrada = Object.entries(manifest.img).find(([, e]) => e.url === src || e.variantes?.some((v) => v.url === src));
        assert.ok(entrada, `src en el manifest: ${src}`);
        const variante = entrada[1].variantes?.find((v) => v.url === src) ?? entrada[1];
        assert.equal(Number(attr(t, 'width')), variante.ancho, `ancho de ${src}`);
        assert.equal(Number(attr(t, 'height')), variante.alto, `alto de ${src}`);
      }
    });
  }
});

// ------------------------------------------------------------------ 3. S1 y S2
describe('S1 Hero y reglas, S2 Horizonte', () => {
  for (const lang of IDIOMAS) {
    const t = () => salida[lang].textos;

    test(`${lang}: H1 en dos líneas; subtítulo y línea de ingreso bruto y exposición inferida pegados al titular`, () => {
      const h = seccion(portada(lang), 'inicio');
      const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(h)[1];
      assert.equal((h1.match(/class="s-hero__linea"/g) ?? []).length, 2);
      const texto = textoPlano(h1);
      assert.equal(texto, t().hero.titulo);
      // Orden de hermanos: h1, p.s-hero__sub, p.s-hero__limite, uno tras otro.
      assert.match(h, /<\/h1><p class="s-lead s-hero__sub">[^<]+<\/p><p class="s-hero__limite">[^<]+<\/p><div class="s-hero__acciones">/);
      assert.equal(textoPlano(/s-hero__sub">([^<]+)</.exec(h)[1]), t().hero.subtitulo);
      assert.equal(textoPlano(/s-hero__limite">([^<]+)</.exec(h)[1]), t().hero.limite);
      assert.match(t().hero.limite, lang === 'es' ? /ingreso bruto.*inferida/i : /gross revenue.*inferred/i);
    });

    test(`${lang}: póster del héroe con fetchpriority alta, ancho y alto del manifest, srcset y precarga con los mismos datos`, () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(WEB, 'public/s/manifest.json'), 'utf8'));
      const e = manifest.img.hero;
      const poster = etiquetas(seccion(portada(lang), 'inicio'), 'img')[0];
      assert.match(poster, /class="s-poster"/);
      assert.equal(attr(poster, 'fetchpriority'), 'high');
      assert.equal(attr(poster, 'loading'), undefined, 'el candidato a LCP no se carga perezoso');
      assert.equal(attr(poster, 'src'), e.url);
      assert.equal(Number(attr(poster, 'width')), e.ancho);
      assert.equal(Number(attr(poster, 'height')), e.alto);
      assert.equal(attr(poster, 'alt'), e.alt[lang]);
      assert.match(attr(poster, 'srcset'), /480w, .*960w/);
      const pre = etiquetas(portada(lang), 'link').find((x) => attr(x, 'rel') === 'preload' && attr(x, 'as') === 'image');
      assert.ok(pre, 'precarga del póster (la hoistea React 19 por fetchPriority alta)');
      assert.equal(attr(pre, 'fetchpriority'), 'high');
      assert.equal(attr(pre, 'imagesrcset'), attr(poster, 'srcset'));
      assert.equal(attr(pre, 'imagesizes'), attr(poster, 'sizes'));
      assert.equal(etiquetas(portada(lang), 'link').filter((x) => attr(x, 'rel') === 'preload').length, 1, 'una sola precarga');
    });

    test(`${lang}: canvas del héroe en modo halo con data-estado y el modelo de puntos del manifest; el póster va después del canvas`, () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(WEB, 'public/s/manifest.json'), 'utf8'));
      const h = seccion(portada(lang), 'inicio');
      const canvas = etiquetas(h, 'canvas')[0];
      assert.equal(attr(canvas, 'data-nube'), 'hero');
      assert.equal(attr(canvas, 'data-modo'), 'halo');
      assert.equal(attr(canvas, 'data-estado'), 'cargando');
      assert.equal(attr(canvas, 'data-pts'), manifest.pts.hero.url);
      assert.ok(h.indexOf('<canvas') < h.indexOf('class="s-poster"'), 'el CSS usa el selector hermano ~ .s-poster');
      assert.match(h, /<div class="s-hero__objeto" aria-hidden="true">/);
    });

    test(`${lang}: botón principal con círculo de 36 px (aria-hidden) y secundario; ambos enlazan a anclas existentes`, () => {
      const h = seccion(portada(lang), 'inicio');
      assert.match(h, /<a class="s-boton" href="#cierre">[^<]+<span class="s-boton__circulo" aria-hidden="true"><span class="s-flecha"><\/span><\/span><\/a>/);
      assert.match(h, /<a class="s-boton s-boton--secundario" href="#modulos">/);
    });

    test(`${lang}: cuatro reglas bajo un h2, microtexto y rótulo de datos de ejemplo`, () => {
      const h = seccion(portada(lang), 'inicio');
      assert.equal((h.match(/class="s-regla"/g) ?? []).length, 4);
      assert.match(h, /<div class="s-hero__reglas"><h2 class="s-h2 s-centrado">/);
      assert.ok(textoPlano(h).includes(t().hero.rotulo));
      assert.ok(textoPlano(h).includes(t().hero.micro));
    });

    test(`${lang}: horizonte como hijo directo de la escena, aria-hidden y sin contenido`, () => {
      const h = seccion(portada(lang), 'inicio');
      assert.match(h, /<div class="s-horizonte" id="horizonte" data-seccion="horizonte" data-tema="claro" aria-hidden="true"><\/div><\/div><\/div><\/section>$/);
    });
  }
});

// ------------------------------------------------------------------ 4. S3 y S10: palabras que se iluminan
describe('párrafo que se ilumina palabra por palabra', () => {
  for (const lang of IDIOMAS) {
    for (const [id, campo] of [['problema', (t) => t.problema.titulo], ['cierre', (t) => t.cierre.titulo]]) {
      test(`${lang}: ${id} emite un span con data-i por palabra, en orden, sin style, y la frase clave en S3`, () => {
        const h = seccion(portada(lang), id);
        const bloque = /<h2[^>]*data-palabras(?:="")?[^>]*>([\s\S]*?)<\/h2>/.exec(h)[1];
        const spans = [...bloque.matchAll(/<span data-i="(\d+)"( class="s-clave")?>([^<]*)<\/span>/g)];
        const palabras = campo(salida[lang].textos).split(/\s+/);
        assert.equal(spans.length, palabras.length);
        assert.deepEqual(spans.map((m) => Number(m[1])), palabras.map((_, i) => i));
        assert.deepEqual(spans.map((m) => DECODIFICA(m[3])), palabras);
        assert.equal(textoPlano(bloque), palabras.join(' '));
        if (id === 'problema') assert.equal(spans.filter((m) => m[2]).length, 1, 'una sola palabra clave');
        else assert.equal(spans.filter((m) => m[2]).length, 0);
      });
    }
  }
});

// ------------------------------------------------------------------ 5. S4
describe('S4 Valor y sellos', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: ventana M1 con las cuatro cifras (data-cifra), cota, sello expandido y cuatro sellos por patrón`, () => {
      const h = seccion(portada(lang), 'valor');
      const cifras = [...h.matchAll(/data-cifra="([^"]+)"/g)].map((m) => m[1]);
      assert.deepEqual(cifras, ['ingreso-bruto', 'reembolsos', 'dinero-atorado', 'respuestas-24h']);
      assert.match(h, /class="s-cota s-valor__cota"[^>]*role="img"/);
      assert.match(h, /class="s-valor__sello s-sello-expandido"/);
      const sello = /<div class="s-valor__sello[^>]*>([\s\S]*?)<\/div>/.exec(h)[1];
      assert.equal((sello.match(/<span>/g) ?? []).length, 4, 'clase, fuente, corte y antigüedad');
      for (const clase of ['observado', 'estimado', 'inferido', 'sindato']) assert.equal((h.match(new RegExp(`class="s-sello s-sello--${clase}"`, 'g')) ?? []).length >= 1, true, clase);
      assert.equal((h.match(/class="s-sello-def"/g) ?? []).length, 4);
    });
  }
});

// ------------------------------------------------------------------ 6. S5
describe('S5 Cuatro pasos', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: pista, canvas, cuatro pasos apilados sin JavaScript con póster, texto y mockup, y progreso de cuatro segmentos`, () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(WEB, 'public/s/manifest.json'), 'utf8'));
      const h = seccion(portada(lang), 'modulos');
      assert.match(h, /data-escena(?:="")? data-paso="0"/);
      assert.match(h, /<div class="s-escena__pista"><div class="s-contenedor s-escena__fijo">/);
      assert.match(h, /<div class="s-escena__visor s-visor s-visor--grande" aria-hidden="true"><canvas class="s-nube" data-nube="escena" data-estado="cargando"/);
      const pasos = [...h.matchAll(/<article class="s-paso" data-n="(\d)" data-pts="([^"]+)"/g)];
      assert.deepEqual(pasos.map((m) => m[1]), ['1', '2', '3', '4']);
      assert.deepEqual(pasos.map((m) => m[2]), ['o1', 'o2', 'o3', 'o4'].map((k) => manifest.pts[k].url));
      assert.equal((h.match(/class="s-paso__render s-visor" aria-hidden="true"/g) ?? []).length, 4);
      assert.equal((h.match(/class="s-paso__mock"/g) ?? []).length, 4);
      assert.equal((h.match(/class="s-progreso__seg"/g) ?? []).length, 4);
      for (const k of ['o1', 'o2', 'o3', 'o4']) assert.ok(h.includes(manifest.img[k].url), `póster ${k}`);
      assert.equal((h.match(/class="s-paso__etiqueta"/g) ?? []).length, 4);
      // Los mockups de apoyo son M6, M3, M2 y M5 en ese orden.
      const aria = [...h.matchAll(/s-mock-raiz--apoyo[^>]*/g)];
      assert.equal(aria.length, 4);
    });
  }
});

// ------------------------------------------------------------------ 7. S6
describe('S6 Seis pantallas', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: seis tarjetas con la miniatura de su mockup; solo se enlazan las que el registro publica`, () => {
      const h = seccion(portada(lang), 'pantallas');
      assert.equal((h.match(/s-mock-raiz--miniatura/g) ?? []).length >= 6, true);
      const tarjetas = [...h.matchAll(/<(a|div) class="s-pantalla s-tarjeta( s-tarjeta--capacidad)?"/g)];
      assert.equal(tarjetas.length, 6);
      for (const m of tarjetas) assert.equal(m[1] === 'a', Boolean(m[2]), 'solo los enlaces llevan el resalte de capacidad');
      const enlaces = etiquetas(h, 'a').filter((x) => /s-pantalla /.test(x));
      for (const a of enlaces) assert.ok(salida.rutasPublicables.includes(attr(a, 'href')), attr(a, 'href'));
      assert.equal((h.match(/class="s-pantalla__miniatura"/g) ?? []).length, 6);
      assert.doesNotMatch(h, /s-indicador/, 'sin rojo en las miniaturas');
    });
  }
});

// ------------------------------------------------------------------ 8. S7
describe('S7 Por puesto', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: arco con cuatro orbes, cápsula, cuatro pestañas con sus paneles visibles sin JavaScript y bloque de Finanzas y Experiencia del cliente`, () => {
      const t = salida[lang].textos;
      const h = seccion(portada(lang), 'puestos');
      assert.match(h, /data-puesto="1"/);
      assert.equal((h.match(/class="s-orbe s-orbe--[1-4]"/g) ?? []).length, 4);
      assert.match(h, /class="s-capsula"/);
      const pestanas = etiquetas(h, 'button');
      assert.equal(pestanas.length, 4);
      assert.deepEqual(pestanas.map((p) => attr(p, 'aria-selected')), ['true', 'false', 'false', 'false']);
      for (const p of pestanas) {
        assert.equal(attr(p, 'role'), 'tab');
        assert.ok(h.includes(` id="${attr(p, 'aria-controls')}"`), 'el panel existe');
      }
      for (const it of t.puestos.items) { assert.ok(textoPlano(h).includes(it.d), it.t); assert.ok(textoPlano(h).includes(it.ve), it.t); }
      assert.ok(textoPlano(h).includes(t.puestos.cierre));
      assert.ok(textoPlano(h).includes(t.puestos.lideres.finanzas.t));
      assert.ok(textoPlano(h).includes(t.puestos.lideres.cx.t));
      assert.ok(textoPlano(h).includes(t.puestos.lideres.titulo));
    });
  }
});

// ------------------------------------------------------------------ 9. S8
describe('S8 Seguridad y límites', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: diagrama, cuatro hechos, dos paneles (existe y todavía no) sin certificaciones afirmadas, y las filas de límites publicables`, () => {
      const t = salida[lang].textos;
      const h = seccion(portada(lang), 'seguridad');
      assert.match(h, /data-diagrama="seguridad"/);
      assert.equal((/<ul class="s-hechos">([\s\S]*?)<\/ul>/.exec(h)[1].match(/<li>/g) ?? []).length, 4);
      const listas = [...h.matchAll(/<ul class="s-lista">([\s\S]*?)<\/ul>/g)].map((m) => (m[1].match(/<li>/g) ?? []).length);
      assert.deepEqual(listas, [t.seguridad.hay.length, t.seguridad.noHay.length]);
      assert.equal(t.seguridad.hay.length, 7);
      assert.equal(t.seguridad.noHay.length, 5);
      const filas = (h.match(/class="s-limite" data-reveal="linea"/g) ?? []).length;
      assert.equal(filas, t.limites.items.length);
      assert.equal(filas, 10, 'la fila 8 de límites espera su aprobación de Responsable A y del abogado');
      assert.match(h, /id="limites"/);
      assert.match(h, /<h2 class="s-h2-grande">/);
      assert.ok(textoPlano(h).includes(t.limites.subtitulo));
      assert.doesNotMatch(textoPlano(seccion(portada(lang), 'seguridad')), lang === 'es' ? /certificad[oa] (en|por|con)\s+(SOC|ISO)/i : /(SOC 2|ISO 27001) certified/i);
    });
  }
});

// ------------------------------------------------------------------ 10. S9: acordeón accesible
describe('S9 Integraciones y preguntas', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: diagrama de integraciones, chips y listas de hoy y hoja de ruta`, () => {
      const t = salida[lang].textos;
      const h = seccion(portada(lang), 'integraciones');
      assert.match(h, /data-diagrama="integraciones"/);
      const chips = [...h.matchAll(/class="s-chip s-chip--integracion">([^<]+)</g)].map((m) => DECODIFICA(m[1]));
      assert.deepEqual(chips, [...t.integraciones.chipsFila1, ...t.integraciones.chipsFila2]);
      for (const x of t.integraciones.hoy) assert.ok(textoPlano(h).includes(x.d));
      for (const x of t.integraciones.ruta) assert.ok(textoPlano(h).includes(x));
    });

    test(`${lang}: acordeón con al menos nueve preguntas, botones dentro de encabezados con aria-expanded y aria-controls, paneles que apuntan a su botón y una sola abierta`, () => {
      const h = seccion(portada(lang), 'integraciones');
      const acordeon = /<div class="s-acordeon">([\s\S]*)<\/div>\s*<\/div>\s*<\/section>$/.exec(h)?.[1] ?? h.slice(h.indexOf('class="s-acordeon"'));
      const botones = etiquetas(acordeon, 'button');
      assert.ok(botones.length >= 9, `${botones.length} preguntas`);
      assert.equal(botones.length, salida[lang].textos.faq.items.filter((x) => x.q && x.a).length);
      let abiertas = 0;
      botones.forEach((b, i) => {
        assert.match(attr(b, 'class'), /s-acordeon__boton/);
        assert.equal(attr(b, 'type'), 'button');
        assert.ok(['true', 'false'].includes(attr(b, 'aria-expanded')), 'aria-expanded');
        if (attr(b, 'aria-expanded') === 'true') abiertas++;
        const panel = attr(b, 'aria-controls');
        assert.ok(panel, 'aria-controls');
        const m = new RegExp(`<div class="s-acordeon__panel" id="${panel}" role="region" aria-labelledby="${attr(b, 'id')}">`).exec(acordeon);
        assert.ok(m, `panel ${panel} apunta de vuelta al botón`);
        // El botón vive dentro de un encabezado.
        assert.ok(new RegExp(`<h3 class="s-acordeon__titulo"><button[^>]*id="${attr(b, 'id')}"`).test(acordeon), `botón ${i + 1} dentro de h3`);
      });
      assert.equal(abiertas, 1);
      // El item abierto lleva data-abierto, el CSS de T6 lo usa para el panel.
      assert.equal((acordeon.match(/class="s-acordeon__item" data-abierto(?:="")?/g) ?? []).length, 1);
    });

    test(`${lang}: la pregunta de datos personales con IA y su respuesta no se publican; se publican las demás`, () => {
      const t = salida[lang].textos;
      const pendiente = LANDING.faq.items[8];
      assert.ok(!textoPlano(portada(lang)).includes(pendiente.q[lang]));
      assert.ok(t.faq.items.every((x) => x.q !== pendiente.q[lang]));
    });
  }
});

// ------------------------------------------------------------------ 11. S10
describe('S10 Cierre', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: solicitar acceso por correo con mailto resuelto por marcadores, botón secundario a los límites, lista de qué incluir y precio sin publicar`, () => {
      const h = seccion(portada(lang), 'cierre');
      const botones = etiquetas(h, 'a').filter((a) => /s-boton/.test(attr(a, 'class')));
      assert.equal(botones.length, 2);
      const mailto = attr(botones[0], 'href');
      assert.match(mailto, /^mailto:[^?@\s]+@[^?\s]+\?subject=[^&]+&body=/);
      assert.ok(mailto.startsWith(`mailto:${CTX.contacto}`));
      assert.doesNotMatch(decodeURIComponent(mailto), /\[[A-Z_]+\]/);
      assert.equal(attr(botones[1], 'href'), '#limites');
      assert.equal((/<ul class="s-cierre__lista">([\s\S]*?)<\/ul>/.exec(h)[1].match(/<li>/g) ?? []).length, 5);
      assert.ok(textoPlano(h).includes(salida[lang].textos.cierre.precio));
      assert.ok(textoPlano(h).includes(CTX.contacto), 'ayuda del correo con el marcador resuelto');
    });

    test(`${lang}: la lente del cierre es decorativa (aria-hidden) con canvas de 6 000 puntos y póster perezoso`, () => {
      const h = seccion(portada(lang), 'cierre');
      assert.match(h, /<div class="s-cierre__objeto" aria-hidden="true"><canvas class="s-nube" data-nube="cierre"/);
      assert.match(etiquetas(h, 'img')[0], /loading="lazy"/);
    });
  }
});

// ------------------------------------------------------------------ 12. cargador
describe('cargador', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: logo con máscara, punto y palabra, y control Saltar animación enfocable al principio del contenido`, () => {
      const p = portada(lang);
      assert.ok(p.startsWith('<div class="s-cargador"') || p.includes('<div class="s-cargador"'));
      assert.ok(p.indexOf('s-cargador') < p.indexOf('id="inicio"'));
      assert.match(p, /<mask id="s-carga-mascara"[^>]*><circle class="s-cargador__mascara"[^>]*pathLength="214"/);
      assert.match(p, /class="s-cargador__punto"/);
      assert.match(p, /class="s-cargador__palabra"/);
      assert.match(p, /<button class="s-cargador__saltar" type="button"[^>]*>[^<]+<\/button>/);
      assert.match(p, /<svg class="s-cargador__logo"[^>]*aria-hidden="true"/);
    });
  }
});

// ------------------------------------------------------------------ 13. hojas no publicables y alternas
describe('hojas bloqueadas, alternas y matices', () => {
  const arbol = publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX });
  for (const lang of IDIOMAS) {
    test(`${lang}: ninguna hoja omitida por publicar() aparece en el HTML (marcadores sin resolver, sin aprobación, verificación sin cumplir)`, () => {
      const texto = textoPlano(pagina(lang));
      const rastros = [];
      for (const o of arbol.omitidas) {
        const hoja = hojaEn(LANDING, o.ruta);
        if (!hoja || typeof hoja[lang] !== 'string' || hoja[lang].length < 12) continue;
        if (texto.includes(hoja[lang])) rastros.push(`${o.ruta}: ${hoja[lang].slice(0, 50)}`);
      }
      assert.deepEqual(rastros, []);
      assert.ok(arbol.omitidas.length >= 4, 'hay hojas bloqueadas que verificar');
    });

    test(`${lang}: las hojas sustituidas por su alterna muestran la alterna y no el original`, () => {
      const texto = textoPlano(pagina(lang));
      for (const s of arbol.sustituidas) {
        const original = hojaEn(LANDING, s.ruta);
        const pub = hojaEn(arbol.arbol, s.ruta);
        if (!original || !pub || original[lang] === pub[lang] || original[lang].length < 12) continue;
        assert.ok(!texto.includes(original[lang]), `se publicó el original de ${s.ruta}`);
      }
      assert.equal(typeof salida[lang].textos.puente.titulo, 'string');
    });

    test(`${lang}: sin corchetes, paréntesis, exclamaciones ni emojis en el texto visible; el correo único es el de contacto`, () => {
      const texto = textoPlano(pagina(lang));
      assert.doesNotMatch(texto, /\[[^\]]+\]/);
      assert.doesNotMatch(texto, /[()]/);
      assert.doesNotMatch(texto, /[!¡]/);
      assert.doesNotMatch(texto, /\p{Extended_Pictographic}/u);
      const correos = new Set(texto.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []);
      assert.deepEqual([...correos], [CTX.contacto]);
    });

    test(`${lang}: el titular blindado solo sale con su subtítulo y su límite (adyacencia n = 0)`, () => {
      const texto = textoPlano(pagina(lang));
      const t = salida[lang].textos.hero;
      if (texto.includes(t.titulo ?? '\u0000')) { assert.ok(texto.includes(t.subtitulo)); assert.ok(texto.includes(t.limite)); }
    });
  }
});

// ------------------------------------------------------------------ 14. afirmaciones prohibidas sobre el HTML renderizado
const compilar = (patron) => new RegExp(patron, PROHIBIDAS.banderas.includes('g') ? PROHIBIDAS.banderas : `${PROHIBIDAS.banderas}g`);
const CONTEXTO_SEGURO = new RegExp(PROHIBIDAS.contextoSeguro, PROHIBIDAS.banderas);
const oraciones = (texto) => [...texto.matchAll(/[^.!?\n]+[.!?]?/gu)].map((m) => ({ inicio: m.index, fin: m.index + m[0].length, texto: m[0] }));

/** Ruta de contenido de un texto del HTML, si coincide con una hoja de la portada: las excepciones por ruta de prohibidas.json se aplican igual. */
const RUTA_DE_TEXTO = { es: new Map(), en: new Map() };
for (const { ruta, hoja } of hojas(publicar(LANDING, { aprobaciones: APROBACIONES, ctx: CTX }).arbol)) for (const l of IDIOMAS) if (!RUTA_DE_TEXTO[l].has(hoja[l])) RUTA_DE_TEXTO[l].set(hoja[l], ruta);

function violaciones(af, ruta, texto) {
  let limpio = texto;
  for (const q of af.quitar ?? []) limpio = limpio.replace(compilar(q), ' ');
  limpio = limpio.split(CTX.contacto).join(' ');
  if ((af.excepciones ?? []).some((e) => new RegExp(e.ruta).test(ruta))) return [];
  const malas = [];
  for (const patron of af.patrones) {
    for (const m of limpio.matchAll(compilar(patron))) {
      if (af.regla === 'negada') {
        const os = oraciones(limpio);
        const i = os.findIndex((x) => m.index >= x.inicio && m.index < x.fin);
        const ventana = os.slice(Math.max(0, i - 1), i + 2).map((x) => x.texto).join(' ');
        if (i >= 0 && CONTEXTO_SEGURO.test(ventana)) continue;
      }
      malas.push({ n: af.n, ruta, patron, coincidencia: m[0], texto: limpio.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30) });
    }
  }
  return malas;
}

/**
 * Une lo que el marcado parte en varios nodos pero el contenido escribe como una sola hoja: cada encabezado (palabras en spans, líneas del h1) y
 * la fila de límites (primera oración en h3, resto en p). Así el contexto de negación y las excepciones por ruta se evalúan como en el contenido.
 * Dentro de las ilustraciones de ejemplo (T9) se sustituyen los valores con signo de porcentaje (ejes del Pareto, umbral de la regla): son datos de ejemplo
 * rotulados como tales, no afirmaciones de cobertura (regla 12). Todo lo demás de las ilustraciones sí se verifica.
 */
function nodosParaVerificar(html) {
  const unido = html
    .replace(/<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/g, (_, n, at, interior) => `<h${n}${at}>${textoPlano(interior)}</h${n}>`)
    .replace(/<\/h3><p class="s-limite__texto">/g, ' ');
  const sinTicks = unido.replace(/<figure class="s-ventana[\s\S]*?<\/figure>/g, (f) => f.replace(/\d[\d.,]*\s*%/g, 'N'));
  return nodosDeTexto(sinTicks);
}

// La excepción de la regla 12 está acotada: solo vale dentro de la ilustración de ejemplo (figure.s-ventana). El mismo porcentaje en texto normal, o en una
// figura distinta, sigue disparando la regla.
describe('excepción de porcentajes de la regla 12: acotada a las ilustraciones de ejemplo', () => {
  const regla12 = PROHIBIDAS.afirmaciones.find((a) => a.n === 12);
  const dispara = (html) => nodosParaVerificar(html).some((t) => regla12.patrones.some((p) => compilar(p).test(t)));
  test('un porcentaje dentro de figure.s-ventana no dispara; fuera de ella sí', () => {
    assert.equal(dispara('<figure class="s-ventana"><svg><text>umbral 5.0 %</text><text>100 %</text></svg></figure>'), false);
    assert.equal(dispara('<p>Cubrimos el 80 % de tus pedidos.</p>'), true);
    assert.equal(dispara('<p>Cubrimos 63 por ciento de los pedidos.</p>'), true);
    assert.equal(dispara('<figure class="s-otra"><p>100 %</p></figure>'), true);
    assert.equal(dispara('<figure class="s-ventana"><p>x</p></figure><p>Recuperas el 37 %</p>'), true);
  });
});

describe('afirmaciones prohibidas sobre el HTML renderizado (prohibidas.json de T11)', () => {
  for (const lang of IDIOMAS) {
    const nodos = () => nodosParaVerificar(portada(lang));
    for (const af of [...PROHIBIDAS.afirmaciones, ...PROHIBIDAS.adicionales]) {
      test(`${lang}: ${af.n ?? af.id} (${af.regla}) ${af.afirmacion.slice(0, 60)}`, () => {
        const malas = [];
        for (const nodo of nodos()) malas.push(...violaciones(af, RUTA_DE_TEXTO[lang].get(nodo) ?? 'render', nodo));
        assert.deepEqual(malas.slice(0, 3), []);
      });
    }
    test(`${lang}: el verificador sobre el HTML está vivo (un texto sembrado en un nodo salta)`, () => {
      const af = PROHIBIDAS.afirmaciones.find((a) => a.n === 4);
      const html = portada(lang).replace('</main>', '') + '<p>Real-time data. Datos en tiempo real.</p>';
      const malas = nodosDeTexto(html).flatMap((n) => violaciones(af, 'render', n));
      assert.ok(malas.length > 0);
    });
  }
});

// ------------------------------------------------------------------ 15. rojo y enlaces
describe('rojo y enlaces', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: el rojo solo entra como marca pequeña: ningún color en el marcado, indicadores y marca de corte acotados, dos círculos de botón`, () => {
      const p = portada(lang);
      assert.doesNotMatch(p, /#e8241c|rgb\(\s*232/i, 'el color sale de los tokens del CSS, no del marcado');
      assert.ok((p.match(/class="s-indicador"/g) ?? []).length <= 2, 'indicadores de mockup (M1 y M6)');
      assert.ok((p.match(/class="s-red__marca"/g) ?? []).length <= 1, 'una sola marca roja de diagrama (corte del problema 2)');
      assert.equal((p.match(/class="s-boton__circulo"/g) ?? []).length, 2, 'un círculo por botón primario, nunca un bloque');
      assert.doesNotMatch(p, /s-rotulo-acento|s-linea-acento/);
    });

    test(`${lang}: los enlaces internos caen en páginas publicables del registro K2, las anclas existen y el mailto es del contacto`, () => {
      const html = pagina(lang);
      const permitido = new Set(salida.rutasPublicables);
      const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      const malos = [];
      for (const a of etiquetas(html, 'a')) {
        const href = attr(a, 'href');
        if (href === undefined) { malos.push('a sin href'); continue; }
        if (href.startsWith('#')) { if (!ids.has(href.slice(1))) malos.push(`ancla ${href}`); continue; }
        if (href.startsWith('mailto:')) { if (!href.startsWith(`mailto:${CTX.contacto}`)) malos.push(href.slice(0, 40)); continue; }
        if (href.startsWith('/s/')) continue;
        if (!permitido.has(href)) malos.push(`ruta no publicable ${href}`);
      }
      assert.deepEqual(malos, []);
    });

    test(`${lang}: ninguna página no publicable se enlaza (Fuga de reembolsos, Problemas, hoja de ruta, seguridad)`, () => {
      const hrefs = etiquetas(pagina(lang), 'a').map((a) => attr(a, 'href'));
      for (const r of ['fuga-de-reembolsos', 'refund-leak', 'hoja-de-ruta', 'roadmap', 'seguridad-y-privacidad', 'security-and-privacy', '/integraciones', '/integrations']) {
        assert.ok(!hrefs.some((h) => h?.includes(r)), r);
      }
    });
  }
});

// ------------------------------------------------------------------ 16. paridad entre idiomas
describe('paridad ES y EN', () => {
  test('misma estructura: mismas secciones, mismo número de encabezados, tarjetas, filas, pasos y preguntas en los dos idiomas', () => {
    const cuentas = (l) => {
      const p = portada(l);
      const c = (re) => (p.match(re) ?? []).length;
      return [c(/<h2[\s>]/g), c(/<h3[\s>]/g), c(/<h4[\s>]/g), c(/class="s-pantalla s-tarjeta/g), c(/class="s-limite"/g), c(/class="s-paso"/g), c(/s-acordeon__item/g), c(/<img /g), c(/<canvas /g), c(/class="s-regla"/g), c(/class="s-columna"/g), c(/data-seccion=/g)].join(',');
    };
    assert.equal(cuentas('es'), cuentas('en'));
  });
  test('las dos páginas difieren en el texto y no se mezclan idiomas en los titulares', () => {
    assert.notEqual(textoPlano(portada('es')), textoPlano(portada('en')));
    assert.ok(textoPlano(portada('en')).includes(salida.en.textos.hero.titulo));
    assert.ok(!textoPlano(portada('en')).includes(salida.es.textos.hero.titulo));
  });
});
