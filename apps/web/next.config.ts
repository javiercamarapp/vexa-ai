import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { NextConfig } from "next";
import { PREFIJOS_PRIVADOS } from './src/lib/site.mjs';

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
      // Landing: scripts vendoreados con versión en el nombre y puntos con hash se cachean un año; el resto de activos de la landing se revalidan cada hora.
      source: '/landing/:path+', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
    }, {
      source: '/vendor/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }, {
      source: '/landing/pts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }, {
      source: '/:archivo(site.webmanifest|push-manifest.webmanifest|robots.txt|sitemap.xml|humans.txt)', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' }],
    }, {
      source: '/.well-known/security.txt', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' }, { key: 'Content-Type', value: 'text/plain; charset=utf-8' }],
    }];
  },
  env: { VEXA_COMPILED_REVISION: revision, VEXA_COMPILED_EXTRACTION_CODE: JSON.stringify(extractionCode) },
};

export default nextConfig;
