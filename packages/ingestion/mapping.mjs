import {parseCSV,parseXLSX,parseMoney,validateContext,timestamp,contentHash,IngestionError,requiredString} from './index.mjs';
const fields=['id','text','date','order','sku','amount','currency','customer'];
const fail=(code,field=null)=>{throw new IngestionError(code,field);};
export function canonicalMapping(mapping){
 if(!mapping||typeof mapping!=='object'||!mapping.columns||Object.keys(mapping).some(k=>!['columns','timezone','dateFormat','currency','sheet'].includes(k))||Object.keys(mapping.columns).some(k=>!fields.includes(k)))fail('INVALID_MAPPING');
 const columns=Object.fromEntries(fields.map(k=>[k,mapping.columns[k]??null]));
 for(const k of fields)if(columns[k]!==null&&(typeof columns[k]!=='string'||!columns[k].length))fail('INVALID_COLUMN',k);
 if(!columns.id||!columns.text)fail('REQUIRED_COLUMNS');
 if(typeof mapping.timezone!=='string'||!mapping.timezone||/^[+-]/.test(mapping.timezone))fail('TIMEZONE_REQUIRED','date');
 try{new Intl.DateTimeFormat('en',{timeZone:mapping.timezone});}catch{fail('INVALID_TIMEZONE','date');}
 if(!['iso','ymd','dmy','mdy'].includes(mapping.dateFormat))fail('DATE_FORMAT_REQUIRED','date');
 const currency=mapping.currency??null;
 if(currency!==null)parseMoney('0',currency);
 if(columns.amount&&!columns.currency&&!currency)fail('CURRENCY_REQUIRED','currency');
 if(mapping.sheet!=null&&(typeof mapping.sheet!=='string'||!mapping.sheet))fail('INVALID_SHEET');
 return {columns,timezone:mapping.timezone,dateFormat:mapping.dateFormat,currency,sheet:mapping.sheet??null};
}
export function mappingVersion(mapping){return 'mapping-v1:'+contentHash({normalizer:'preview-v1',mapping:canonicalMapping(mapping)});}
export function normalizeDate(value,timezone,format){
 if(value==null||value==='')return null;
 if(typeof value!=='string')fail('INVALID_DATE','date');
 if(/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value))return timestamp(value,'date');
 let m,y,mo,d,h=0,mi=0,s=0;
 if(format==='iso'||format==='ymd'){m=/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);if(m)[,y,mo,d,h=0,mi=0,s=0]=m;}
 else if(format==='dmy'||format==='mdy'){m=/^(\d{2})\/(\d{2})\/(\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);if(m){y=m[3];d=m[format==='dmy'?1:2];mo=m[format==='dmy'?2:1];h=m[4]??0;mi=m[5]??0;s=m[6]??0;}}
 if(!m)fail(/^\d+(?:\.\d+)?$/.test(value)?'UNSUPPORTED_EXCEL_DATE':'INVALID_DATE','date');
 [y,mo,d,h,mi,s]=[y,mo,d,h,mi,s].map(Number);
 if(y<1000||mo<1||mo>12||d<1||d>new Date(Date.UTC(y,mo,0)).getUTCDate()||h>23||mi>59||s>59)fail('INVALID_CALENDAR','date');
 const local=Date.UTC(y,mo-1,d,h,mi,s),fmt=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const parts=ms=>Object.fromEntries(fmt.formatToParts(ms).map(p=>[p.type,p.value]));
 const offsets=new Set();for(let n=-48;n<=48;n+=6){const ms=local+n*3600000,p=parts(ms);offsets.add(Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-ms);}
 const candidates=[...offsets].map(offset=>local-offset).filter(ms=>{const p=parts(ms);return +p.year===y&&+p.month===mo&&+p.day===d&&+p.hour===h&&+p.minute===mi&&+p.second===s;});
 if(candidates.length!==1)fail(candidates.length?'DST_FOLD':'DST_GAP','date');
 return new Date(candidates[0]).toISOString();
}
export function inspectImport(bytes,{contentType,sheet=null,discover=false}={}){
 let parsed,sheets=[];
 if(contentType==='text/csv')parsed=parseCSV(bytes,{maxRows:50001});
 else if(contentType==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){
  const workbook=parseXLSX(bytes,{maxRows:50001});sheets=workbook.sheets.map(s=>s.name);
  if(!sheet&&sheets.length!==1){if(discover)return {headers:[],sheets,rows:[],errors:[]};fail('SHEET_REQUIRED');}
  parsed=workbook.sheets.find(s=>s.name===(sheet??sheets[0]));if(!parsed)fail('SHEET_NOT_FOUND');
 }else fail('UNSUPPORTED_CONTENT_TYPE');
 const head=parsed.rows[0];if(!head||head.line!==1||parsed.errors.some(e=>e.line===1))fail('INVALID_HEADER');
 const headers=head.values;if(headers.some(v=>typeof v!=='string'||!v)||new Set(headers).size!==headers.length)fail('DUPLICATE_OR_EMPTY_HEADER');
 return {headers,sheets,rows:parsed.rows.slice(1),errors:parsed.errors};
}
export function previewImport(bytes,{contentType,mapping,context,observedAt,sampleLimit=20}={}){
 validateContext(context);timestamp(observedAt,'observedAt');const config=canonicalMapping(mapping);
 if(!Number.isSafeInteger(sampleLimit)||sampleLimit<1||sampleLimit>100)fail('INVALID_SAMPLE_LIMIT');
 const parsed=inspectImport(bytes,{contentType,sheet:config.sheet});
 for(const k of fields)if(config.columns[k]&&!parsed.headers.includes(config.columns[k]))fail('COLUMN_NOT_FOUND',k);
 const errors=parsed.errors.map(e=>({line:e.line,field:null,code:e.code})),rejected=new Set(errors.map(e=>e.line));let accepted=0;const sample=[];
 const indexes=Object.fromEntries(fields.map(k=>[k,parsed.headers.indexOf(config.columns[k])]));
 for(const row of parsed.rows){if(rejected.has(row.line))continue;try{
  if(row.values.length!==parsed.headers.length)fail('COLUMN_COUNT');
  const data=Object.fromEntries(fields.map(k=>[k,indexes[k]<0?null:row.values[indexes[k]]]));
  requiredString(data.id,'id');if(typeof data.text!=='string'||[...data.text].length>2000)fail('INVALID_TEXT','text');
  const normalized={id:data.id,text:data.text,occurred_at:normalizeDate(data.date,config.timezone,config.dateFormat),order:data.order||null,sku:data.sku||null,customer:data.customer||null,money:data.amount==null||data.amount===''?null:parseMoney(data.amount,config.columns.currency?data.currency:config.currency)};
  accepted++;if(sample.length<sampleLimit)sample.push({line:row.line,row_ref:row.line,...normalized});
 }catch(e){if(!(e instanceof IngestionError))throw e;rejected.add(row.line);errors.push({line:row.line,field:e.field,code:e.code});}}
 return {mapping_version:mappingVersion(config),input_rows:accepted+rejected.size,headers:parsed.headers,sheets:parsed.sheets,sample:{limit:sampleLimit,rows:sample,representative:false},coverage:{accepted,rejected:rejected.size,duplicates:0,pending:0},coverage_kind:'validation',deduplication:'deferred-to-F02-04',errors:errors.sort((a,b)=>a.line-b.line)};
}
export function exportRowErrors(errors){
 const cell=v=>{let s=String(v??'');if(/^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return 'line,field,code\r\n'+errors.map(e=>[e.line,e.field,e.code].map(cell).join(',')+'\r\n').join('');
}
