import { ES_HOST_LANDING as esHostDelSitio } from '../../src/lib/host-routing.mjs';

// Preparación del sitio para buscadores y agentes de IA (T2). Una sola fuente para robots.txt, las reglas de cabeceras de los espejos Markdown y la
// negociación Accept: text/markdown. Pura: sin Next ni lectura de archivos, para que la usen robots.ts, las pruebas y T3 (next.config).

/** Rutas internas que nunca se rastrean en rovaq.ai. Los activos viven en /s/ y deben poder cargarse (scripts, puntos, imágenes), así que /s/ no se bloquea. */
export const DISALLOW_SITIO = Object.freeze(['/sitio/', '/api/', '/_next/data/']);

/** Búsqueda y recuperación (construyen el índice que cita), y agentes que leen una página porque una persona lo pidió. Permitidos siempre. */
export const BOTS_BUSQUEDA_Y_AGENTES = Object.freeze([
  'Googlebot', 'Bingbot', 'DuckDuckBot', 'DuckAssistBot', 'Applebot', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot',
  'ChatGPT-User', 'Claude-User', 'Perplexity-User', 'MistralAI-User',
]);
/** Entrenamiento de modelos: política del parche, permitir el contenido público y bloquear lo privado. Decisión reversible del dueño (aquí es un solo cambio). */
export const BOTS_ENTRENAMIENTO = Object.freeze([
  'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Meta-ExternalAgent', 'Amazonbot', 'cohere-ai',
]);
/** Rastreadores que ignoran robots.txt: se cierran aquí y, aparte, con una regla de Firewall que hace el dueño. */
export const BOTS_BLOQUEADOS = Object.freeze(['Bytespider']);

/** robots.txt de rovaq.ai: contenido público abierto con política explícita por rastreador; lo interno cerrado. */
export function reglasSitio() {
  return [
    { userAgent: '*', allow: '/', disallow: [...DISALLOW_SITIO] },
    { userAgent: [...BOTS_BUSQUEDA_Y_AGENTES], allow: '/', disallow: [...DISALLOW_SITIO] },
    { userAgent: [...BOTS_ENTRENAMIENTO], allow: '/', disallow: [...DISALLOW_SITIO] },
    { userAgent: [...BOTS_BLOQUEADOS], disallow: '/' },
  ];
}
/** robots.txt de app.rovaq.ai y de cualquier otro host (vistas previas, hosts antiguos): nada se rastrea y no se anuncia sitemap. El noindex por cabecera es la segunda barrera. */
export function reglasHostPrivado() {
  return [{ userAgent: '*', disallow: '/' }];
}

// ---------------------------------------------------------------- reglas para T3 (next.config.ts) y T14

/** `espejoDe(id, lang)` devuelve la ruta del espejo (rutaEspejo de metadatos.mjs con el manifest). Cabeceras de los espejos Markdown y de los archivos llms: para leerse, no para aparecer como resultado (noindex) y con el canonical HTML en Link. */
export function reglasCabecerasEspejos(fichas, espejoDe, base = 'https://rovaq.ai') {
  const cache = { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' };
  const comunes = [{ key: 'X-Robots-Tag', value: 'noindex' }, cache];
  const reglas = [];
  for (const f of fichas) {
    for (const lang of ['es', 'en']) {
      const archivo = espejoDe(f.id, lang);
      if (!archivo) continue;
      const canonica = f.ruta[lang] === '/' ? `${base}/` : `${base}${f.ruta[lang]}`;
      reglas.push({
        source: archivo,
        headers: [{ key: 'Content-Type', value: 'text/markdown; charset=utf-8' }, { key: 'Link', value: `<${canonica}>; rel="canonical"` }, ...comunes],
      });
    }
  }
  for (const source of ['/llms.txt', '/llms-full.txt', '/en/llms.txt', '/en/llms-full.txt']) {
    reglas.push({ source, headers: [{ key: 'Content-Type', value: 'text/plain; charset=utf-8' }, ...comunes] });
  }
  return reglas;
}

/**
 * Negociación de contenido sin detección por User-Agent (eso sería cloaking): la misma URL sirve HTML por defecto y su espejo Markdown si el cliente pide
 * text/markdown de forma explícita. Reglas de rewrite con `has` por cabecera Accept y por host, generadas desde las fichas. No se aplican aquí: T3 las
 * incorpora a next.config.ts (beforeFiles) o T14 decide hacerlo en el middleware, junto con Vary: Accept en la respuesta.
 */
export function reglasNegociacionMarkdown(fichas, espejoDe) {
  // `has` solo compara con una expresión regular: no entiende los valores q de Accept. Esta versión es la conservadora (cualquier mención de text/markdown);
  // si se necesita la precisión de host-routing.prefiereMarkdown (prioridad igual o mayor que text/html), la negociación debe vivir en el middleware.
  const has = [{ type: 'host', value: 'rovaq.ai' }, { type: 'header', key: 'accept', value: '.*text/markdown.*' }];
  const reglas = [];
  for (const f of fichas) {
    for (const lang of ['es', 'en']) {
      const destino = espejoDe(f.id, lang);
      if (!destino) continue;
      reglas.push({ source: f.ruta[lang], has, destination: destino });
    }
  }
  return reglas;
}

/** Marcadores que bloquean security.txt: no se publica hasta que ambos existan. */
export const SECURITY_TXT_MARCADORES = Object.freeze(['[CORREO_DE_SEGURIDAD]', '[FECHA_DE_REVISION]']);

/** Plantilla de security.txt (RFC 9116). generar-md.mjs solo la escribe en public/.well-known/ cuando ambos valores están resueltos. */
export function plantillaSecurityTxt({ correo, expira, base = 'https://rovaq.ai' }) {
  return [
    '# Política de reporte de vulnerabilidades de Rovaq AI (RFC 9116).',
    `Contact: mailto:${correo}`,
    `Expires: ${expira}`,
    'Preferred-Languages: es, en',
    `Canonical: ${base}/.well-known/security.txt`,
    '',
  ].join('\n');
}

/** Decisión de robots.txt por host (la usa src/app/robots.ts). rovaq.ai y www: política del sitio con su sitemap. Cualquier otro host: todo cerrado y sin sitemap. */
export function robotsParaHost(host, landingBase = 'https://rovaq.ai') {
  if (esHostDelSitio(host)) return { rules: reglasSitio(), sitemap: `${landingBase}/sitemap.xml` };
  return { rules: reglasHostPrivado() };
}
