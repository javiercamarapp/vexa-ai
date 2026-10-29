// AUTH-01 (cierre de seguridad 28-oct): toda ruta que entrega un archivo (Content-Disposition) debe negar la descarga a una
// sesión de soporte («ver como») con la autoridad de la base (forDownload / acción 'export' / session.support),
// sin depender de la cookie vexa_support ni de una expresión regular de rutas. Si aparece una ruta nueva de descarga y no
// declara su guardia, esta prueba falla y obliga a decidirlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../..');
const roots=['apps/web/src','packages'];
const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.next','tests'].includes(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|tsx|mjs)$/.test(e.name)&&!/\.test\./.test(e.name)&&!f.includes('/sitio'))files.push(f);}}).call(null,path.join(root,'apps/web/src'));
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.next','tests'].includes(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(/\.(ts|tsx|mjs)$/.test(e.name)&&!/\.test\./.test(e.name))files.push(f);}}).call(null,path.join(root,'packages'));
const conDescarga=files.filter(f=>/content-disposition/i.test(fs.readFileSync(f,'utf8'))&&/attachment/.test(fs.readFileSync(f,'utf8')));
// El panel de briefs solo pone el nombre del archivo en el cliente; las rutas de jobs viven en un handler de paquete (la ruta lo envuelve con forDownload).
const EXENTOS=new Map([['apps/web/src/components/briefs/panel.tsx','cliente: arma el nombre; la descarga la sirve la ruta'],['packages/jobs/durable/api.mjs','handler de paquete: apps/web/src/lib/jobs/server.ts lo envuelve con forDownload'],['packages/jobs/imports.mjs','handler de paquete: apps/web/src/lib/jobs/server.ts lo envuelve con forDownload']]);
test('hay rutas de descarga detectadas (la prueba no es vacía)',()=>{assert.ok(conDescarga.length>=6,String(conDescarga.length));});
for(const f of conDescarga){
  const rel=path.relative(root,f);
  test('descarga con guardia de soporte en la base: '+rel,()=>{
    if(EXENTOS.has(rel))return;
    assert.match(fs.readFileSync(f,'utf8'),/forDownload|support_export_blocked|session\.support/,rel+' entrega archivos sin guardia de soporte');
  });
}
test('los envoltorios exentos de jobs sí usan forDownload',()=>{
  const j=fs.readFileSync(path.join(root,'apps/web/src/lib/jobs/server.ts'),'utf8');
  assert.match(j,/forDownload\(/);assert.match(j,/errors/);
});
