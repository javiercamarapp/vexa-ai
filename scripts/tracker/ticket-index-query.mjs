// Genera las consultas SELECT (solo lectura) para construir el índice de tickets. NO se conecta a nada.
// Uso: node ticket-index-query.mjs --tenant <uuid> --out <carpeta> [--root <rovaq ai>]
// Lee los 4 XLSX (solo lectura), reúne los ids de ticket candidatos (unión de versiones) y escribe:
//   candidatos.txt (ids, para filtrar el resultado), 1-resumen.sql, 2-ids.sql (ambas SIN lista de ids)   (carpeta 0700)
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {VERSIONS,loadBytes,planVersion} from '../../packages/ingestion/tracker/loader.mjs';
import {candidateIds,summarySql,idsSql} from '../../packages/ingestion/tracker/ticket-index.mjs';
if(!VERSIONS.length){console.error('Faltan trackerVersions: cree config/cliente-piloto.local.json (ver config/cliente-piloto.ejemplo.json)');process.exit(2);}
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const tenant=arg('tenant'),out=arg('out'),root=arg('root',path.join(process.env.HOME,'Desktop/rovaq ai'));
if(!tenant||!out){console.error('Uso: --tenant <uuid> --out <carpeta> [--root dir]');process.exit(2);}
const all=new Set();const per={};
for(const v of VERSIONS){const p=planVersion(loadBytes(root,v),{});const ids=candidateIds(p.jobs);per[v.key]=ids.length;ids.forEach(i=>all.add(i));}
const ids=[...all].sort((a,b)=>a.length-b.length||(a<b?-1:1));
mkdirSync(out,{recursive:true,mode:0o700});
writeFileSync(path.join(out,'candidatos.txt'),ids.join('\n')+'\n',{mode:0o600});
writeFileSync(path.join(out,'1-resumen.sql'),summarySql(tenant),{mode:0o600});
writeFileSync(path.join(out,'2-ids.sql'),idsSql(tenant),{mode:0o600});
console.log(JSON.stringify({candidatos_unicos:ids.length,por_version:per,archivos:['candidatos.txt','1-resumen.sql','2-ids.sql']}));
