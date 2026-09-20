import assert from 'node:assert/strict';
// These are assertions, not a reference implementation or a candidate report reader.
export function coverage(r,n){
 assert.equal(r.input_rows,n,'INPUT_ROWS');
 for(const k of ['accepted','rejected','duplicates','pending'])assert.ok(Number.isSafeInteger(r.coverage[k])&&r.coverage[k]>=0,'COUNTER:'+k);
 assert.equal(Object.values(r.coverage).reduce((a,b)=>a+b,0),n,'COVERAGE_SUM');
 assert.equal(r.sample.representative,false,'SAMPLE_NOT_POPULATION');assert.ok(r.sample.rows.length<=r.sample.limit,'SAMPLE_LIMIT');
 assert.equal(typeof r.mapping_version,'string','MAPPING_HASH');assert.ok(r.mapping_version.length>0,'MAPPING_HASH');
 for(const e of r.errors){assert.deepEqual(Object.keys(e).sort(),['code','field','line'],'ERROR_NO_PII_FIELDS');assert.ok(Number.isInteger(e.line)&&e.line>0,'ERROR_LINE');assert.equal(typeof e.code,'string');assert.ok(e.code.length>0,'ERROR_CODE');}
}
export async function rejectsDomain(fn,label){
 let result;try{result=await fn();}catch(e){assert.equal(typeof e.code,'string',label+':DOMAIN_CODE');assert.ok(e.code.length>0,label+':DOMAIN_CODE');assert.doesNotMatch(e.code,/^(ERR_|ENOENT|EACCES|ECONN|SETUP|INFRA)/,label+':NOT_SETUP');return;}
 assert.ok(result?.errors?.length>0,label);assert.equal(result.coverage.accepted,0,label);assert.ok(result.coverage.rejected>0,label);
}
export function money(r,expected){assert.deepEqual(r.money,expected,'EXACT_MONEY_NULL_NOT_ZERO');}
export function instant(r,expected){assert.equal(r.occurred_at??r.envelope?.occurred_at,expected,'EXACT_UTC_INSTANT');}
export function status(r,n,label){assert.equal(r.status,n,label);return r.data?.data;}
export function queued(d){assert.equal(d.state,'queued','QUEUED_NOT_COMPLETED');}
// Independent RFC4180 decoder: do not use candidate parseCSV to judge its export.
export function decodeCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=c;}
 else if(c==='"'){assert.equal(cell,'','CSV_QUOTE_POSITION');quoted=true;}else if(c===','){row.push(cell);cell='';}else if(c==='\r'){assert.equal(text[++i],'\n','CSV_RFC4180_EOL');row.push(cell);rows.push(row);row=[];cell='';}else {assert.notEqual(c,'\n','CSV_RFC4180_EOL');cell+=c;}}
 assert.equal(quoted,false,'CSV_UNCLOSED');if(row.length||cell){row.push(cell);rows.push(row);}return rows;
}
export function safeExport(text,count){
 assert.equal(typeof text,'string','CSV_STRING');const rows=decodeCSV(text);assert.deepEqual(rows.shift(),['line','field','code'],'CSV_HEADER');assert.equal(rows.length,count,'CSV_ERROR_COUNT');
 for(const row of rows){assert.equal(row.length,3,'CSV_THREE_FIELDS');for(const value of row)assert.doesNotMatch(value,/^[\s\x00-\x20\x7f]*[=+\-@]/u,'CSV_FORMULA');}
 assert.doesNotMatch(text,/SYNTHETIC_PRIVATE_PAYLOAD|syn-private@example\.test/,'CSV_NO_PII');return rows;
}
