// Aviso de privacidad y Términos (ola 3, legal): fallan cerrados mientras falte la razón social, el domicilio o el correo de privacidad.
// Se corre con: node --test tests/sitio/legal.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AVISO_DE_PRIVACIDAD, TERMINOS } from '../../src/content/sitio/paginas/legal.ts';
import { contextoPorDefecto, datosLegalesDeEntorno, estadoPagina, publicar, hojas, marcadoresEn } from '../../src/lib/sitio/marcadores.mjs';
import { SITE } from '../../src/lib/site.mjs';
import { espejosLegalesSinVariables } from '../../../../tools/sitio/generar-md.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const APROB = JSON.parse(fs.readFileSync(path.join(aqui, '../../src/content/sitio/aprobaciones.json'), 'utf8'));
const OK = { VEXA_LEGAL_ENTIDAD: 'Ejemplo Servicios SA de CV', VEXA_LEGAL_DOMICILIO: 'Calle Ejemplo 123, Colonia Centro, Ciudad de México', VEXA_LEGAL_CORREO: 'privacidad@ejemplo.test' };
const ctx = (env) => contextoPorDefecto(SITE, env);
const estado = (pagina, env) => estadoPagina(pagina, { aprobaciones: APROB, ctx: ctx(env), tipo: 'legal' });
const PAGINAS = [AVISO_DE_PRIVACIDAD, TERMINOS];

describe('datos legales desde el entorno', () => {
  test('sin variables no hay ningún dato; con las tres se resuelven recortadas', () => {
    assert.deepEqual(datosLegalesDeEntorno({}), { razonSocial: null, domicilio: null, correoPrivacidad: null });
    assert.deepEqual(datosLegalesDeEntorno({ ...OK, VEXA_LEGAL_ENTIDAD: '  Ejemplo SA  ' }), { razonSocial: 'Ejemplo SA', domicilio: OK.VEXA_LEGAL_DOMICILIO, correoPrivacidad: OK.VEXA_LEGAL_CORREO });
  });

  test('un valor vacío, con corchetes, con salto de línea o un correo sin forma de dirección no cuenta', () => {
    for (const [k, malo] of [['VEXA_LEGAL_ENTIDAD', ''], ['VEXA_LEGAL_ENTIDAD', '   '], ['VEXA_LEGAL_ENTIDAD', '[RAZON_SOCIAL]'], ['VEXA_LEGAL_DOMICILIO', '[DOMICILIO]'], ['VEXA_LEGAL_DOMICILIO', 'corto'], ['VEXA_LEGAL_DOMICILIO', 'Calle 1\nCiudad de México'], ['VEXA_LEGAL_CORREO', 'sin-arroba'], ['VEXA_LEGAL_CORREO', 'a b@c.mx'], ['VEXA_LEGAL_CORREO', '[CORREO]@x.mx']]) {
      const d = datosLegalesDeEntorno({ ...OK, [k]: malo });
      assert.equal(Object.values(d).filter((v) => v === null).length, 1, `${k}=${JSON.stringify(malo)}`);
    }
  });

  test('el contexto por defecto del proceso no trae datos legales inventados', () => {
    const c = contextoPorDefecto(SITE, {});
    assert.equal(c.razonSocial, null);
    assert.equal(c.domicilio, null);
    assert.equal(c.correoPrivacidad, null);
    assert.equal(c.contacto, SITE.contacto);
  });
});

describe('falla cerrado', () => {
  test('sin ninguna variable, las dos páginas no son publicables y lo dicen por marcador', () => {
    for (const p of PAGINAS) {
      const e = estado(p, {});
      assert.equal(e.publicable, false, p.id);
      const motivos = e.motivos.join('\n');
      for (const marca of ['[RAZON_SOCIAL]', '[DOMICILIO]', '[CORREO_DE_PRIVACIDAD]']) assert.ok(motivos.includes(marca), `${p.id} ${marca}`);
    }
  });

  test('si falta una sola de las tres, ninguna de las dos páginas se publica', () => {
    for (const falta of Object.keys(OK)) {
      const env = { ...OK };
      delete env[falta];
      for (const p of PAGINAS) assert.equal(estado(p, env).publicable, false, `${p.id} sin ${falta}`);
      const vacia = { ...OK, [falta]: '' };
      for (const p of PAGINAS) assert.equal(estado(p, vacia).publicable, false, `${p.id} con ${falta} vacía`);
    }
  });

  test('con las tres variables se publican y el texto sale con los datos, sin marcadores ni corchetes', () => {
    for (const p of PAGINAS) {
      assert.equal(estado(p, OK).publicable, true, estado(p, OK).motivos.join());
      const { arbol } = publicar(p, { aprobaciones: APROB, ctx: ctx(OK), prefijo: `paginas.${p.id}` });
      for (const lang of ['es', 'en']) {
        const texto = hojas(arbol).map((h) => h.hoja[lang]).join('\n');
        assert.ok(texto.includes(OK.VEXA_LEGAL_ENTIDAD), `${p.id}.${lang} razón social`);
        assert.ok(texto.includes(OK.VEXA_LEGAL_DOMICILIO), `${p.id}.${lang} domicilio`);
        assert.ok(texto.includes(OK.VEXA_LEGAL_CORREO), `${p.id}.${lang} correo`);
        assert.ok(!/[\[\]]/.test(texto), `${p.id}.${lang} corchetes`);
        assert.deepEqual(marcadoresEn(texto), []);
      }
    }
  });
});

describe('contenido legal', () => {
  test('solo hay tres marcadores externos, equivalentes en los dos idiomas', () => {
    const permitidos = new Set(['[RAZON_SOCIAL]', '[LEGAL_NAME]', '[DOMICILIO]', '[ADDRESS]', '[CORREO_DE_PRIVACIDAD]', '[PRIVACY_EMAIL]']);
    for (const p of PAGINAS) for (const { hoja } of hojas(p)) for (const l of ['es', 'en']) for (const m of marcadoresEn(hoja[l])) assert.ok(permitidos.has(m), `${p.id}: ${m}`);
    for (const p of PAGINAS) assert.deepEqual(marcadoresEn(JSON.stringify(hojas(p).map((h) => h.hoja.es))).map((m) => m.replace(/^\[.*\]$/, 'x')).length, marcadoresEn(JSON.stringify(hojas(p).map((h) => h.hoja.en))).length);
  });

  test('el aviso dice lo que el código hace: la IA no calcula importes y la redacción no es anonimización', () => {
    const es = hojas(AVISO_DE_PRIVACIDAD).map((h) => h.hoja.es).join('\n');
    assert.match(es, /No calcula importes/);
    assert.match(es, /Redactar no es anonimizar/);
    assert.match(es, /no escribe en esa herramienta|no escribe/i);
    assert.doesNotMatch(es, /\bVexa\b/);
  });

  test('no nombra a clientes finales ni terceros sin autorización: ni el cliente piloto ni otros nombres de cliente', () => {
    // Los nombres vetados del cliente piloto se comparan por huella SHA-256 (el repositorio es público y no puede contenerlos en claro).
    const HUELLAS_VETADAS = new Set(['d51db60749a2709ca9cf7eab289bbad72852adf3e3e00716d42159e3c78225da', 'b084aa36c5f6efdd6ff341cfea3499e7c27c134ff267cc31209bc0383ee40dc5']);
    const vetada = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).some((w) => w && HUELLAS_VETADAS.has(createHash('sha256').update(w).digest('hex')));
    for (const p of PAGINAS) for (const { hoja } of hojas(p)) for (const l of ['es', 'en']) { assert.ok(!vetada(hoja[l]), 'nombre vetado en el texto legal'); assert.doesNotMatch(hoja[l], /innovativos|likida/i); }
  });

  test('el respaldo se describe sin afirmar más de lo que existe: 8 días, sin punto exacto, sin adjuntos, sin restauración probada', () => {
    const es = hojas(AVISO_DE_PRIVACIDAD).map((h) => h.hoja.es).join('\n');
    assert.match(es, /respaldo diario automático que se conserva 8 días/);
    assert.match(es, /adjuntos no están cubiertos/);
    assert.match(es, /aún no se ha probado/);
    assert.doesNotMatch(es, /35 días/);
  });

  test('terminación y baja: solo se promete lo que el operador puede cumplir (solicitud escrita, 60 días, procedimiento manual)', () => {
    for (const [lang, pagina] of [['es', AVISO_DE_PRIVACIDAD], ['es', TERMINOS], ['en', AVISO_DE_PRIVACIDAD], ['en', TERMINOS]]) {
      const t = hojas(pagina).map((h) => h.hoja[lang]).join('\n');
      assert.doesNotMatch(t, /\b90 (días|days)/, `${pagina.id} ${lang}: sin plazo de 90 días para cuentas`);
      assert.doesNotMatch(t, /(30 (días|days))[^.]{0,40}(export)|export[^.]{0,40}(30 (días|days))/i, `${pagina.id} ${lang}: sin exporte de 30 días`);
    }
    const es = hojas(AVISO_DE_PRIVACIDAD).map((h) => h.hoja.es).join('\n');
    assert.match(es, /A solicitud escrita de la empresa, dentro de los 60 días siguientes a la solicitud/);
    assert.match(es, /procedimiento manual del operador/);
    assert.match(es, /previa solicitud y sin demora indebida/);
    const en = hojas(AVISO_DE_PRIVACIDAD).map((h) => h.hoja.en).join('\n');
    assert.match(en, /written request of the company, within 60 days after the request/);
    assert.match(en, /upon request and without undue delay/);
  });

  test('distingue los dos papeles: responsable y encargado', () => {
    const es = hojas(AVISO_DE_PRIVACIDAD).map((h) => h.hoja.es).join('\n');
    assert.match(es, /responsable/);
    assert.match(es, /encargado/);
  });
});

describe('espejos .md legales (se comitean y se sirven estáticos)', () => {
  const RUTAS = ['s/md/es/aviso-de-privacidad.0123abcd.md', 's/md/en/aviso-de-privacidad.0123abcd.md', 's/md/es/terminos.89abcdef.md', 's/md/en/terminos.89abcdef.md', 's/md/es/a1.ef87e5df.md', 's/md/es/estado.12345678.md'];
  test('sin las tres variables, un espejo del aviso o de los términos se señala; los demás no', () => {
    const sueltos = espejosLegalesSinVariables(RUTAS, {});
    assert.equal(sueltos.length, 4);
    assert.ok(sueltos.every((r) => /aviso-de-privacidad|terminos/.test(r)));
    for (const falta of Object.keys(OK)) assert.equal(espejosLegalesSinVariables(RUTAS, { ...OK, [falta]: '' }).length, 4, `sin ${falta}`);
  });
  test('con las tres variables no se señala nada', () => {
    assert.deepEqual(espejosLegalesSinVariables(RUTAS, OK), []);
  });
  test('el repositorio no trae espejos legales comiteados mientras las variables no estén fijadas', () => {
    const dir = path.join(aqui, '../../public/s/md');
    const rutas = ['es', 'en'].flatMap((l) => (fs.existsSync(path.join(dir, l)) ? fs.readdirSync(path.join(dir, l)).map((f) => `s/md/${l}/${f}`) : []));
    assert.deepEqual(espejosLegalesSinVariables(rutas, {}), []);
  });
});
