// RSS 2.0 del blog, uno por idioma (T2). Vacío hasta que haya artículos publicados: un canal sin items es válido y no rompe a los lectores.
// Solo entran artículos indexables y con fecha real de publicación. El canal lleva el resumen, no el cuerpo.
import { landingUrl } from '../site.mjs';
import { HREFLANG, rutaRss, urlAbsoluta } from './metadatos.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const rfc822 = (iso) => new Date(`${iso}T00:00:00Z`).toUTCString();

export function rssXml({ lang, fichas, base = landingUrl() }) {
  const blog = fichas.find((f) => f.id === 'blog');
  const inicio = fichas.find((f) => f.id === 'inicio');
  const articulos = fichas
    .filter((f) => f.tipo === 'articulo' && f.indexable && f.pub)
    .sort((a, b) => String(b.pub).localeCompare(String(a.pub)));
  // Si el índice del blog aún no se publica, el canal apunta a la portada: un enlace a una página que da 404 no sirve.
  const destino = blog?.indexable ? blog : inicio;
  const titulo = lang === 'es' ? 'Blog de Rovaq AI' : 'Rovaq AI blog';
  const descripcion = blog?.indexable ? blog.descripcion[lang] : inicio.descripcion[lang];
  const ultima = articulos[0]?.pub ?? inicio.mod ?? '1970-01-01';
  const items = articulos.map((a) => `    <item>
      <title>${esc(a.h1[lang])}</title>
      <link>${esc(urlAbsoluta(a.ruta[lang], base))}</link>
      <guid isPermaLink="true">${esc(urlAbsoluta(a.ruta[lang], base))}</guid>
      <pubDate>${rfc822(a.pub)}</pubDate>${a.etiqueta ? `\n      <category>${esc(a.etiqueta)}</category>` : ''}
      <description>${esc(a.descripcion[lang])}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(titulo)}</title>
    <link>${esc(urlAbsoluta(destino.ruta[lang], base))}</link>
    <description>${esc(descripcion)}</description>
    <language>${HREFLANG[lang].toLowerCase()}</language>
    <lastBuildDate>${rfc822(ultima)}</lastBuildDate>
    <atom:link href="${esc(base + rutaRss(lang))}" rel="self" type="application/rss+xml" />${items ? `\n${items}` : ''}
  </channel>
</rss>
`;
}
