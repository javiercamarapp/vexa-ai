// Ruta desconocida en la aplicación. Con varias raíces (sin app/layout.tsx), una URL sin coincidencia caería en el 404 genérico de Next.
// Una página con notFound() no sirve: el loading.tsx de la app abre un Suspense y la respuesta saldría 200 (404 «blando»). Un handler responde
// 404 real para cualquier método: HTML con el texto de not-found (idioma por cookie) a quien navega y JSON a quien consume la API.
import type {NextRequest} from 'next/server';
import {traductor} from '../../../lib/i18n';
import {COOKIE_IDIOMA, resolverIdioma} from '../../../lib/i18n/idioma';

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c] as string));
const CABECERAS = {'cache-control': 'private, no-store, max-age=0, must-revalidate', 'x-robots-tag': 'noindex, nofollow, noarchive'};

function noEncontrada(request: NextRequest) {
  const quiereHtml = !request.nextUrl.pathname.startsWith('/api/') && (request.headers.get('accept') ?? '').includes('text/html');
  const idioma = resolverIdioma({cookie: request.cookies.get(COOKIE_IDIOMA)?.value});
  const t = traductor(idioma);
  if (!quiereHtml) return Response.json({error: {code: 'not_found', message: t('tr.nf.titulo'), retryable: false}}, {status: 404, headers: CABECERAS});
  const html = `<!DOCTYPE html><html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>404 · Rovaq AI</title>`
    + '<style>:root{color-scheme:light dark}body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;font:16px/1.5 system-ui,sans-serif;background:#fff;color:#0e0e10}@media(prefers-color-scheme:dark){body{background:#0e0e10;color:#f4f4f5}}main{max-width:32rem;padding:24px}.e{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}a{display:inline-block;margin-top:16px;padding:8px 16px;border-radius:8px;background:#0e0e10;color:#fff;text-decoration:none}@media(prefers-color-scheme:dark){a{background:#f4f4f5;color:#0e0e10}}</style></head>'
    + `<body><main><p class="e">Rovaq AI · 404</p><h1>${escapar(t('tr.nf.titulo'))}</h1><p>${escapar(t('tr.nf.cuerpo'))}</p><a href="/overview">${escapar(t('det.irAHoy'))}</a></main></body></html>`;
  return new Response(html, {status: 404, headers: {...CABECERAS, 'content-type': 'text/html; charset=utf-8'}});
}
export const GET = noEncontrada, HEAD = noEncontrada, POST = noEncontrada, PUT = noEncontrada, PATCH = noEncontrada, DELETE = noEncontrada, OPTIONS = noEncontrada;
