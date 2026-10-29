// B5 (auditoría 2): todo módulo de apps/web/src/lib que lee un secreto de servidor (process.env sin NEXT_PUBLIC_) debe llevar `import 'server-only'`
// o estar en la lista explícita de módulos puros que reciben el entorno como argumento. Una prueba de cabeceras comprueba además HSTS con preload.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const lib=path.resolve(import.meta.dirname,'../src/lib');
const archivos=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|tsx|mjs)$/.test(e.name)&&!/\.d\.(ts|mts)$/.test(e.name))archivos.push(f);}})(lib);
// Lecturas de entorno que NO son secretas o que son configuración pública/pura del entorno: se listan con motivo.
const EXENTOS=new Map([['i18n/idioma.ts','solo NODE_ENV'],['site.mjs','solo NEXT_PUBLIC_*'],['auth.ts','lee NEXT_PUBLIC_* y la llave publicable; los secretos viven en otros módulos'],['db-resiliencia.mjs','recibe el entorno por argumento']]);
const SECRETO=/process\.env\.(?!NEXT_PUBLIC_|NODE_ENV\b|VERCEL_ENV\b|VERCEL_URL\b)[A-Z_]*(?:SECRET|KEY|TOKEN|PASSWORD|DATABASE_URL|SALT|CA_PEM)\b/;
test('todo archivo de src/lib que lee un secreto de servidor tiene import server-only (o está exento con motivo)',()=>{
  const sin=[];
  for(const f of archivos){const rel=path.relative(lib,f).replace(/\\/g,'/');const t=fs.readFileSync(f,'utf8');
    if(!SECRETO.test(t))continue;if(/^\s*import\s+['"]server-only['"]/m.test(t)||EXENTOS.has(rel))continue;
    // Un módulo .mjs puro importado por el cliente no puede llevar server-only; si lee secretos, debe pasar al servidor.
    sin.push(rel);}
  assert.deepEqual(sin,[],'agrega import \'server-only\' (o exención con motivo en esta prueba)');
});
test('throttle.ts del enlace de acceso lleva server-only',()=>{assert.match(fs.readFileSync(path.join(lib,'email-auth/throttle.ts'),'utf8'),/^import 'server-only';/m);});
