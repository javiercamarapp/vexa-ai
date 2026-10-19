// Extracción con prompt COMPACTO. Mantiene los contratos del gateway: el modelo solo devuelve REFERENCIAS de mensaje
// (nunca texto/offsets); el servidor las resuelve al span exacto y valida con validateModelExtraction (esquema, cita textual,
// quote_hash, rol). Cambios frente al gateway actual (packages/gateway/index.mjs):
//  - cada mensaje se envía UNA vez (sin available_evidence con quote duplicado, sin available_values);
//  - ref corta por mensaje ("m0".."m39"); evidencia = mensaje completo (<= 3800 puntos de código, prefijo del texto redactado);
//  - esquema CONSTANTE por taxonomía (sin enum de refs por conversación) para que el prefijo (system+taxonomía+esquema) sea cacheable;
//  - entidades: valor literal que debe aparecer dentro de la evidencia citada y fuera de marcadores [PII]/[REDACTED] (misma regla que safeEntityOccurrence).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractionSchema,validateModelExtraction,sha256} from '../intelligence/index.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));

function gatewayParts(){ // lee del código del gateway para no divergir
  const src=fs.readFileSync(path.join(HERE,'../gateway/index.mjs'),'utf8');
  const pick=n=>{const m=new RegExp('^const '+n+'=(.*);$','m').exec(src);if(!m)throw Error('no se halló '+n);return new Function('return '+m[1])();};
  return{SYSTEM:pick('SYSTEM'),ENTITY_RULES:pick('ENTITY_RULES'),CONTEXT_RULES:pick('CONTEXT_RULES')};
}
export function compactPrompt(){
  const {SYSTEM,ENTITY_RULES,CONTEXT_RULES}=gatewayParts();
  const paras=SYSTEM.split('\n');
  if(paras.length!==4)throw Error('SYSTEM del gateway cambió de forma: revisar compact.mjs');
  const p1=paras[0].replace('Use only supplied taxonomy and revisions.','Use only supplied taxonomy and revisions.');
  const p2='Each revision has a short reference ("m0", "m1", ...), a role and its text. For every issue or entity, evidence MUST be an array of reference STRINGS such as ["m0"], naming the message(s) that support the claim. Return refs only; never reproduce quotes, text, start or end. The server resolves each reference to the exact message text and validates it. A whole message is valid evidence if it supports the claim. You may reuse a reference for issues and entities. Use only references that exist.';
  const p3='For entities, value is the exact literal phrase (at most 200 characters) copied from one of that entity\'s cited messages: do not normalize, translate, abbreviate or spell it out, and never include redaction placeholders. Omit an entity if no literal phrase fits.';
  const p4=paras[3].replace(/ The wire schema also accepts legacy spans.*$/u,'');
  return [p1,p2,p3,p4].join('\n')+ENTITY_RULES+CONTEXT_RULES;
}
export const promptHash=()=>sha256(compactPrompt());

// Esquema constante por taxonomía.
export function compactSchema(taxonomy,{refMode='pattern'}={}){
  const s=extractionSchema(taxonomy,{modelOutput:true});
  const ref=refMode==='enum'?{type:'string',enum:Array.from({length:40},(_,i)=>'m'+i)}:{type:'string',pattern:'^m[0-9]{1,2}$'};
  for(const f of['issues','entities'])s.properties[f].items.properties.evidence.items=ref;
  return s;
}
export const schemaHash=taxonomy=>sha256(JSON.stringify(compactSchema(taxonomy)));

export function buildRequest(revisions,taxonomy,{model,provider,maxTokens=1500,refMode='pattern',requireParameters=true,temperature=null}={}){
  const system=compactPrompt()+'\nTaxonomy (supplied categories): '+JSON.stringify(taxonomy);
  const payload={revisions:revisions.map((r,i)=>({ref:'m'+i,role:r.role,text:r.text}))};
  const body={model,messages:[{role:'system',content:[{type:'text',text:system,cache_control:{type:'ephemeral'}}]},{role:'user',content:JSON.stringify(payload)}],
    response_format:{type:'json_schema',json_schema:{name:'vexa_extraction_compact_v1',strict:true,schema:compactSchema(taxonomy,{refMode})}},
    max_tokens:maxTokens,...(temperature===null?{}:{temperature}),usage:{include:true}, // sin `reasoning`: desactivarlo bajó la precisión a 0.75 en las fixtures (haiku-ccn-full)

    provider:{...(provider?{only:[provider]}:{}),allow_fallbacks:false,...(requireParameters?{require_parameters:true}:{}),data_collection:'deny'}};
  return body;
}

const markerIntervals=t=>[...t.matchAll(/\[(?:PII|REDACTED)\]/g)].map(m=>[m.index,m.index+m[0].length]);
function literalOutsideMarkers(value,text){
  const mk=markerIntervals(text);
  for(let at=text.indexOf(value);at!==-1;at=text.indexOf(value,at+1))if(!mk.some(([a,b])=>a<at+value.length&&b>at))return true;
  return false;
}
// Resuelve refs -> spans y valida con el validador de producción. Devuelve {ok,data,code}.
export function resolveAndValidate(raw,revisions,taxonomy,tenantId='ia-escala'){
  try{
    const refs=new Map(revisions.map((r,i)=>['m'+i,{message_revision_id:r.message_id,start:0,end:r.keptLen,quote:r.text,role:r.role}]));
    const out=structuredClone(raw);
    for(const kind of['issues','entities']){
      if(!Array.isArray(out?.[kind]))return{ok:false,code:'invalid_output'};
      for(const it of out[kind]){
        if(!it||!Array.isArray(it.evidence))return{ok:false,code:'invalid_output'};
        it.evidence=it.evidence.map(e=>{if(typeof e!=='string'||!refs.has(e))throw Error('bad_ref');return structuredClone(refs.get(e));});
        if(kind==='entities'&&(typeof it.value!=='string'||!it.evidence.some(s=>literalOutsideMarkers(it.value,s.quote))))throw Error('bad_entity');
      }
    }
    const revs=revisions.map(r=>({tenant_id:tenantId,message_revision_id:r.message_id,role:r.role,text:r.text}));
    const v=validateModelExtraction(out,revs,{taxonomy,tenantId});
    return v.ok?{ok:true,data:v.data}:{ok:false,code:'invalid_output'};
  }catch(e){return{ok:false,code:e.message==='bad_ref'?'invalid_reference':e.message==='bad_entity'?'invalid_entity':'invalid_output'};}
}
