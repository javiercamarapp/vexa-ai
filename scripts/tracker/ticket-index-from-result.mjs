// Convierte el resultado de 2-ids.sql (texto crudo guardado en un archivo) en el índice ids.txt para --ticket-index.
// Uso: node ticket-index-from-result.mjs --result resultado.txt --candidates candidatos.txt --out ids.txt
import {readFileSync,writeFileSync} from 'node:fs';
import {parseIdsResult} from '../../packages/ingestion/tracker/ticket-index.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const [res,cand,out]=['result','candidates','out'].map(k=>arg(k));
if(!res||!cand||!out){console.error('Uso: --result f --candidates f --out f');process.exit(2);}
const candidates=readFileSync(cand,'utf8').split(/\s+/).filter(Boolean);
try{
 const r=parseIdsResult(readFileSync(res,'utf8'),candidates);
 writeFileSync(out,r.ids.join('\n')+'\n',{mode:0o600});
 console.log(JSON.stringify({candidatos:candidates.length,vinculables:r.ids.length,sin_conversacion:candidates.length-r.ids.length,ignorados_no_candidatos:r.ignored_not_candidate,duplicados:r.duplicates}));
}catch(e){console.error(e.code??e.message);process.exit(1);}
