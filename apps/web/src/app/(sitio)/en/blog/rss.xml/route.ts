// RSS 2.0 del blog en en. Estático en el build; vacío hasta que haya artículos publicados (src/lib/sitio/rss.mjs).
import {rssXml} from '../../../../../lib/sitio/rss.mjs';
import {fichasSitio} from '../../../../../components/sitio/shell/metadatos';

export const dynamic = 'force-static';

export function GET() {
  return new Response(rssXml({lang: 'en', fichas: fichasSitio()}), {
    headers: {'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'},
  });
}
