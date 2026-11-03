#!/usr/bin/env node
// Escribe docs/legal/aviso-de-privacidad.{es,en}.md y terminos.{es,en}.md desde apps/web/src/content/sitio/paginas/legal.ts (fuente única).
// Los marcadores se dejan visibles: es el texto que revisa el abogado. Uso: node tools/sitio/exportar-legal.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { AVISO_DE_PRIVACIDAD, TERMINOS } = await import(path.join(raiz, 'apps/web/src/content/sitio/paginas/legal.ts'));

function aMarkdown(pagina, lang) {
  const salida = [`# ${pagina.h1[lang]}`, '', pagina.subtitulo[lang], ''];
  for (const bloque of pagina.bloques) {
    if (bloque.titulo) salida.push(`## ${bloque.titulo[lang]}`, '');
    if (bloque.tipo === 'texto') salida.push(bloque.texto[lang], '');
    else for (const it of bloque.items) salida.push(`- ${it[lang]}`);
    if (bloque.tipo !== 'texto') salida.push('');
  }
  return salida.join('\n');
}

const destino = path.join(raiz, 'docs/legal');
for (const [nombre, pagina] of [['aviso-de-privacidad', AVISO_DE_PRIVACIDAD], ['terminos', TERMINOS]]) {
  for (const lang of ['es', 'en']) fs.writeFileSync(path.join(destino, `${nombre}.${lang}.md`), aMarkdown(pagina, lang));
}
console.log('docs/legal: aviso y términos exportados en es y en');
