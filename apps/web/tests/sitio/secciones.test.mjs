// Pruebas de la portada (T8): las diez secciones S1 a S10 renderizadas con react-dom/server en ES y EN, dentro del marco de T7.
// Revisa orden, temas, encabezados, escáneres de T12, hojas no publicables, afirmaciones prohibidas (prohibidas.json de T11) sobre el
// HTML renderizado, rojo, enlaces contra el registro K2, accesibilidad del acordeón y el contrato de marcado de T6.
// El render corre en un proceso hijo con tsx (los componentes son TSX) y un cargador que trata los .css como vacíos.
import { test, describe } from 'node:test';
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

// T16: temas agrupados para reducir los volteos oscuro/claro a dos (oscuro hasta los pasos, claro de pantallas a integraciones, oscuro al cierre).
const SECCIONES = [
  { clave: 'hero', id: 'inicio', tema: 'oscuro' },
  { clave: 'horizonte', id: 'horizonte', tema: null },
  { clave: 'problema', id: 'problema', tema: 'oscuro' },
  { clave: 'valor', id: 'valor', tema: 'oscuro' },
  { clave: 'pasos', id: 'modulos', tema: 'oscuro' },
  { clave: 'pantallas', id: 'pantallas', tema: 'claro' },
  { clave: 'puestos', id: 'puestos', tema: 'claro' },
  { clave: 'seguridad', id: 'seguridad', tema: 'claro' },
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
        assert.equal(attr(abre, 'data-tema'), s.tema ?? undefined, `${s.id} tema`);
        if (s.clave === 'horizonte') continue; // S2 no tiene contenido ni tema: es un resplandor decorativo aria-hidden; el tema es global
        assert.ok(['oscuro', 'claro'].includes(attr(abre, 'data-tema')), s.id);
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

    test(`${lang}: sin costuras ni fondos propios por sección: el tema es global (data-ambiente)`, () => {
      const abre = (id) => /^<[^>]+>/.exec(seccion(portada(lang), id))[0];
      for (const id of ['inicio', 'problema', 'valor', 'modulos', 'pantallas', 'puestos', 'seguridad', 'integraciones', 'cierre']) {
        assert.doesNotMatch(abre(id), /\bs-costura\b|s-seccion--alterna|s-seccion--corte/, id);
      }
      assert.doesNotMatch(portada(lang), /s-costura|s-cargador|data-nube|<canvas/);
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

    test(`${lang}: la ventana del héroe es la captura real de Fuga (tema oscuro) con fetchpriority alta, ancho y alto del manifest, AVIF con respaldo WebP y precarga`, () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(WEB, 'public/s/manifest.json'), 'utf8'));
      const e = manifest.img[lang === 'en' ? 'producto/en/fuga-oscuro' : 'producto/fuga-oscuro'];
      const h = seccion(portada(lang), 'inicio');
      const img = etiquetas(h, 'img')[0];
      assert.match(img, /class="s-ventana__img"/);
      assert.equal(attr(img, 'fetchpriority'), 'high');
      assert.equal(attr(img, 'loading'), undefined, 'el candidato a imagen del pliegue no se carga perezoso');
      assert.equal(attr(img, 'src'), e.url);
      assert.equal(Number(attr(img, 'width')), e.ancho);
      assert.equal(Number(attr(img, 'height')), e.alto);
      assert.equal(attr(img, 'alt'), e.alt[lang]);
      assert.match(h, /<source type="image\/avif" srcSet="[^"]*"|<source type="image\/avif" srcset="[^"]*"/i);
      for (const tipo of ['avif', 'webp']) {
        const srcset = attr(etiquetas(h, 'source').find((t) => attr(t, 'type') === `image/${tipo}`), 'srcset') ?? attr(etiquetas(h, 'source').find((t) => attr(t, 'type') === `image/${tipo}`), 'srcSet');
        assert.match(srcset, /-960\.[0-9a-f]{8}\.\w+ 960w, .*-1440\.[0-9a-f]{8}\.\w+ 1440w, .*-2880\.[0-9a-f]{8}\.\w+ 2880w/, `${lang}: el héroe pide ${tipo} hasta 2880 para pantallas de doble densidad`);
      }
      assert.ok(h.includes('<figure class="s-ventana s-ventana--producto"'), 'figure.s-ventana: la excepción de porcentajes de la regla 12 está acotada a ella');
      assert.doesNotMatch(h, /<canvas|s-poster|data-nube/);
    });

    test(`${lang}: capa SVG del Pareto: nueve filas enfocables con tooltip, línea de acumulado y marca de 80 por ciento; cifra de 36 000 USD con sello Observado`, () => {
      const h = seccion(portada(lang), 'inicio');
      assert.equal((h.match(/class="s-ov__fila"/g) ?? []).length, 9);
      assert.equal((h.match(/class="s-ov__fila"[^>]*tabindex="0"/g) ?? []).length, 9);
      assert.equal((h.match(/class="s-ov__tip"/g) ?? []).length, 9);
      assert.match(h, /class="s-ov__acum"[^>]*pathLength="1"/);
      assert.match(h, /data-cuenta="36000"/);
      assert.match(h, /class="s-sello s-sello--observado s-ov-cifra__sello"/);
      assert.doesNotMatch(h, /class="s-punto/, 'el héroe no añade rojo propio: solo el punto del botón y el del logo (máximo tres elementos con la barra roja del producto)');
      assert.doesNotMatch(h, /style=/);
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

    test(`${lang}: horizonte de 120 px al pie del héroe, aria-hidden, sin tema ni contenido`, () => {
      const h = seccion(portada(lang), 'inicio');
      assert.match(h, /<div class="s-horizonte" id="horizonte" data-seccion="horizonte" aria-hidden="true"><\/div><\/section>$/);
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
    test(`${lang}: captura real de Hoy (sin mockup dibujado a mano), cota, sello expandido y cuatro sellos por patrón`, () => {
      const h = seccion(portada(lang), 'valor');
      assert.match(h, /<figure class="s-ventana s-ventana--producto">/);
      assert.match(etiquetas(h, 'img')[0], /class="s-ventana__img"/);
      assert.ok(h.includes(`/s/img/producto/${lang === 'en' ? 'en-' : ''}valor-`), 'recorte de las cuatro tarjetas de Hoy, en el idioma de la página');
      assert.doesNotMatch(h, /s-mock-raiz|data-cifra/);
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
    test(`${lang}: pista, cuatro pasos apilados sin JavaScript con visual propio (recorte de captura real y capa SVG), texto y progreso de cuatro segmentos`, () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(WEB, 'public/s/manifest.json'), 'utf8'));
      const h = seccion(portada(lang), 'modulos');
      assert.match(h, /data-escena(?:="")? data-paso="0"/);
      assert.match(h, /<div class="s-escena__pista"><div class="s-contenedor s-escena__fijo">/);
      assert.doesNotMatch(h, /<canvas|s-nube|s-poster|s-paso__mock|data-pts/);
      const pasos = [...h.matchAll(/<article class="s-paso" data-n="(\d)" data-visto=""/g)];
      assert.deepEqual(pasos.map((m) => m[1]), ['1', '2', '3', '4']);
      assert.equal((h.match(/class="s-paso__visual"/g) ?? []).length, 4);
      assert.equal((h.match(/class="s-progreso__seg"/g) ?? []).length, 4);
      for (const k of [1, 2, 3, 4]) {
        assert.ok(h.includes(manifest.img[`producto/${lang === 'en' ? 'en/' : ''}paso${k}`].url), `recorte paso${k}`);
        assert.ok(h.includes(`data-paso-ventana="${k}"`), `ventana del paso ${k}`);
      }
      assert.equal((h.match(/class="s-paso__etiqueta"/g) ?? []).length, 4);
      // Paso 1: tres hebras punteadas y una continua; paso 3: dos ramas que no se unen; paso 4: registro pendiente de revisión.
      assert.equal((h.match(/class="s-pv__hebra s-pv__hebra--punteada"/g) ?? []).length, 3);
      assert.equal((h.match(/class="s-pv__rama"/g) ?? []).length, 1);
      assert.equal((h.match(/class="s-pv__rama s-pv__rama--punteada"/g) ?? []).length, 1);
      assert.doesNotMatch(h, /style=/);
    });
  }
});

// ------------------------------------------------------------------ 7. S6
describe('S6 Seis pantallas', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: seis tarjetas con la captura real del producto; solo se enlazan las que el registro publica`, () => {
      const h = seccion(portada(lang), 'pantallas');
      assert.equal((h.match(/class="s-pantalla__img"/g) ?? []).length, 6, 'seis capturas reales');
      assert.equal((h.match(/<source type="image\/avif"/gi) ?? []).length, 6, 'AVIF con respaldo WebP');
      assert.doesNotMatch(h, /s-mock-raiz/, 'sin mockups dibujados a mano');
      // T16: cada tarjeta es un div con enlace estirado dentro del título (el nombre accesible es solo el texto visible del enlace); solo las enlazadas llevan el resalte
      const tarjetas = [...h.matchAll(/<div class="s-pantalla s-tarjeta( s-tarjeta--capacidad)?"[^>]*>([\s\S]*?)(?=<div class="s-pantalla s-tarjeta|<\/div><\/div><p class="s-mt-48"|<\/div><\/div><\/section>)/g)];
      assert.equal(tarjetas.length, 6);
      for (const m of tarjetas) assert.equal(/<a class="s-pantalla__enlace"/.test(m[2]), Boolean(m[1]), 'solo los enlaces llevan el resalte de capacidad');
      const enlaces = etiquetas(h, 'a').filter((x) => /s-pantalla__enlace/.test(x));
      for (const a of enlaces) assert.ok(salida.rutasPublicables.includes(attr(a, 'href')), attr(a, 'href'));
      assert.doesNotMatch(h, /aria-labelledby="pantalla-\d-titulo"/, 'sin nombre accesible que difiera del texto visible (axe label-content-name-mismatch)');
      assert.equal((h.match(/class="s-pantalla__miniatura"/g) ?? []).length, 6);
      assert.equal((h.match(/data-pantalla-sel=/g) ?? []).length, 6, 'selector de las seis pantallas');
      assert.match(h, /role="region" aria-roledescription="carrusel"[^>]*tabindex="0"/, 'carrusel enfocable');
      assert.doesNotMatch(h, /s-indicador/, 'sin rojo en las miniaturas');
    });
  }
});

// ------------------------------------------------------------------ 8. S7
describe('S7 Por puesto', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: arco con cuatro discos de ícono, cápsula, cuatro pestañas con sus paneles visibles sin JavaScript y bloque de Finanzas y Experiencia del cliente`, () => {
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
      const chips = [...h.matchAll(/class="s-chip s-chip--integracion s-chip--(?:auto|archivo|ruta)">([^<]+)</g)].map((m) => DECODIFICA(m[1]));
      assert.deepEqual(chips, [...t.integraciones.chipsAuto, ...t.integraciones.chipsArchivo, ...t.integraciones.chipsFila2]);
      for (const x of t.integraciones.hoy) assert.ok(textoPlano(h).includes(x.d));
      for (const x of t.integraciones.ruta) assert.ok(textoPlano(h).includes(x));
    });

    test(`${lang}: las integraciones van en tres grupos rotulados y cada píldora de hoja de ruta lleva su rótulo textual`, () => {
      const g = salida[lang].textos.integraciones;
      const h = seccion(portada(lang), 'integraciones');
      const grupo = (clase) => new RegExp(`<div class="s-integ-grupo s-integ-grupo--${clase}">([\\s\\S]*?)</ul></div>`).exec(h)?.[1] ?? '';
      const nombres = (html) => [...html.matchAll(/<li class="s-chip s-chip--integracion[^"]*">([^<]+)/g)].map((m) => DECODIFICA(m[1]));
      const auto = grupo('auto');
      const archivo = grupo('archivo');
      const ruta = grupo('ruta');
      assert.ok(textoPlano(auto).includes(g.gruposRotulos.auto), 'rótulo de conexión automática');
      assert.ok(textoPlano(archivo).includes(g.gruposRotulos.archivo), 'rótulo de carga de archivos');
      assert.ok(textoPlano(ruta).includes(g.gruposRotulos.ruta), 'rótulo de hoja de ruta');
      assert.deepEqual(nombres(auto), ['HubSpot'], 'HubSpot es la única conexión automática');
      assert.deepEqual(nombres(archivo), ['Excel', 'CSV']);
      assert.deepEqual(nombres(ruta), ['Amazon', 'Walmart', 'Shopify']);
      const marcas = [...ruta.matchAll(/<li class="s-chip s-chip--integracion s-chip--ruta">[^<]+<span class="s-chip__marca">([^<]+)<\/span><\/li>/g)].map((m) => m[1]);
      assert.deepEqual(marcas, ['Amazon', 'Walmart', 'Shopify'].map(() => g.chipRutaMarca), 'cada píldora de hoja de ruta lleva su rótulo');
      assert.match(g.chipRutaMarca, lang === 'es' ? /hoja de ruta/i : /roadmap/i);
      // Ninguna de las tres de hoja de ruta aparece como píldora fuera de su grupo.
      const fuera = h.replace(ruta, '');
      for (const n of ['Amazon', 'Walmart', 'Shopify']) {
        assert.doesNotMatch(fuera, new RegExp(`<li class="s-chip[^"]*">${n}`), `${n} fuera del grupo de hoja de ruta`);
        assert.doesNotMatch(auto + archivo, new RegExp(n));
      }
      // Sin logos de marketplaces: ni imagen ni SVG de marca dentro de los grupos.
      assert.doesNotMatch(auto + archivo + ruta, /<(img|svg|picture)\b/);
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

    test(`${lang}: el cierre ya no lleva objeto decorativo (sin lente, canvas ni póster)`, () => {
      const h = seccion(portada(lang), 'cierre');
      assert.doesNotMatch(h, /s-cierre__objeto|<canvas|<img|s-poster/);
    });
  }
});

// ------------------------------------------------------------------ 12. sin cargador
describe('sin cargador bloqueante', () => {
  for (const lang of IDIOMAS) {
    test(`${lang}: la portada empieza en el héroe: ni cargador ni control Saltar animación (el héroe se lee desde el primer pintado)`, () => {
      const p = portada(lang);
      assert.doesNotMatch(p, /s-cargador|data-cargador|s-carga-mascara|data-saltar-cargador/);
      assert.ok(p.indexOf('id="inicio"') >= 0 && p.indexOf('id="inicio"') < 40, 'la sección del héroe abre el contenido');
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
