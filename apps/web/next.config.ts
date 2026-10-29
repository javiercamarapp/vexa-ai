import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { NextConfig } from "next";
import { PREFIJOS_PRIVADOS } from './src/lib/site.mjs';
import { reglasHost } from './config/sitio/reglas-host.mjs';

// Public build identity only. Next inlines this value into the compiled route;
// changing a runtime environment variable does not relabel an existing build.
const revision = process.env.VEXA_BUILD_REVISION ?? "";
if (revision !== "" && !/^[0-9a-f]{40}$/.test(revision)) {
  throw new Error("VEXA_BUILD_REVISION must be a complete lowercase Git SHA");
}
// Bind candidate eligibility to the actual source compiled into this artifact.
// This public fingerprint is derived here; never read it from deployment env.
const extractionPaths = ["packages/gateway/index.mjs","packages/gateway/budget.mjs","packages/gateway/catalog.mjs","packages/gateway/residency.mjs","packages/intelligence/index.mjs","packages/intelligence/runtime.mjs","packages/intelligence/extraction-repository.mjs","packages/intelligence/evidence-repository.mjs","packages/intelligence/metadata/normalize.mjs","packages/intelligence/metadata/repository.mjs","packages/intelligence/metadata/resolve.mjs","packages/intelligence/metadata/runtime.mjs","packages/intelligence/metadata/hosted.mjs","packages/intelligence/candidates/resolve.mjs","packages/jobs/durable/runtime.mjs"];
const extractionCode = Object.fromEntries(extractionPaths.map(name => {
  const file = resolve(__dirname, '../..', name), stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('CANDIDATE_RUNTIME_SOURCE_INVALID');
  return [name, createHash('sha256').update(readFileSync(file)).digest('hex')];
}));
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `next dev` no debe generar AGENTS.md/CLAUDE.md en el árbol del producto.
  agentRules: false,
  // Enrutamiento por host (rovaq.ai sirve el sitio, www redirige al apex, la aplicación queda en app.rovaq.ai). Reglas derivadas de src/lib/host-routing.mjs.
  // VERCEL_ENV=production solo existe en el build de producción: ahí los hosts antiguos de Vercel y /sitio/... en la aplicación redirigen.
  async redirects() { return reglasHost({ produccion: process.env.VERCEL_ENV === 'production' }).redirects; },
  async rewrites() { const { beforeFiles, afterFiles, fallback } = reglasHost({ produccion: process.env.VERCEL_ENV === 'production' }); return { beforeFiles, afterFiles, fallback }; },
  async headers() {
    const privado = PREFIJOS_PRIVADOS.map(p => p.slice(1)).join('|');
    // Plan para pasar la CSP a enforce: ver docs/SEO-Y-PUBLICACION.md (vigilar la consola 1-2 semanas con Report-Only, retirar 'unsafe-inline' con nonces y recién entonces renombrar la cabecera).
    const cspReportOnly = [
      "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:",
      "font-src 'self' data:", "connect-src 'self' https://*.supabase.co wss://*.supabase.co", "worker-src 'self' blob:", "manifest-src 'self'",
      "form-action 'self' https://accounts.google.com https://*.supabase.co", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    ].join('; ');
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'" },
      { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ] }, {
      // B-01 (auditoría 4): `preload` solo en los hosts propios (rovaq.ai, www y app). Nunca en *.vercel.app, que no es nuestro dominio. La cabecera sola no inscribe nada:
      // la inscripción en hstspreload.org la decide Javier tras confirmar que TODOS los subdominios de rovaq.ai sirven HTTPS (retirarse de la lista es lento).
      source: '/:path*', has: [{ type: 'host', value: '(?:app\\.|www\\.)?rovaq\\.ai' }], headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      ],
    }, {
      // Cierre de seguridad 29-oct: cabeceras extra SOLO para el host de la aplicación (el sitio público en rovaq.ai/www no las recibe).
      // CORP evita que otros orígenes incrusten recursos de la app (fuentes, marca, exportaciones); el resto cierra rutas de lectura cruzada heredadas.
      source: '/:path*', has: [{ type: 'host', value: 'app.rovaq.ai' }], headers: [
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        { key: 'Origin-Agent-Cluster', value: '?1' },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
      ],
    }, {
      // Espacio de trabajo, plataforma, acceso y API: nunca se indexan (segunda barrera además del metadata robots de cada segmento).
      source: `/:privado(${privado})/:path*`, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
    }, {
      source: `/:privado(${privado})`, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
    }, {
      // Next's configured headers also apply to route responses. Preserve the
      // stricter attachment policy instead of replacing it with the page policy.
      source: '/api/briefs/:id/export', headers: [
        { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" },
      ],
    }, {
      // Fuentes y marca: el nombre del archivo cambia si cambia el contenido (regla en docs/SEO-Y-PUBLICACION.md), así que se cachean un año.
      source: '/:carpeta(fonts|brand)/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }, {
      // Sitio público: los activos de /s/ llevan hash de 8 caracteres en el nombre (nube, scripts, puntos, imágenes, fuentes), así que se cachean un año.
      source: '/s/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }, {
      source: '/vendor/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }, {
      source: '/:archivo(site.webmanifest|push-manifest.webmanifest|robots.txt|sitemap.xml|humans.txt)', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' }],
    }, {
      source: '/.well-known/security.txt', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' }, { key: 'Content-Type', value: 'text/plain; charset=utf-8' }],
    }];
  },
  env: { VEXA_COMPILED_REVISION: revision, VEXA_COMPILED_EXTRACTION_CODE: JSON.stringify(extractionCode) },
};

export default nextConfig;
