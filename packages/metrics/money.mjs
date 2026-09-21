import {validateWindow,assertCompatibleWindows} from './scope.mjs';
export class MoneyContractError extends Error{constructor(code){super(code);this.name='MoneyContractError';this.code=code;}}
const check=(ok,code)=>{if(!ok)throw new MoneyContractError(code);};
const text=x=>typeof x==='string'&&x.trim().length>0;
const integer=x=>typeof x==='string'&&x.length<=4096&&/^(0|-?[1-9]\d*)$/.test(x);
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const ordered=items=>[...new Map(items.map(x=>[canonical(x),x])).entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,x])=>x);
function currencyExponent(catalog,currency){check(catalog&&text(catalog.version)&&catalog.currencies&&/^[A-Z]{3}$/.test(currency)&&Object.hasOwn(catalog.currencies,currency),'CURRENCY_CATALOG_REQUIRED');const exponent=catalog.currencies[currency];check(Number.isInteger(exponent)&&exponent>=0&&exponent<=9,'EXPONENT_INVALID');return exponent;}
export function validateMoney(input,catalog){
 check(input&&text(input.metric_id)&&text(input.tenant_id)&&text(input.basis)&&text(input.grain),'METRIC_IDENTITY_REQUIRED');
 const exponent=currencyExponent(catalog,input.currency);check(input.exponent===exponent&&input.catalog_version===catalog.version,'CATALOG_VERSION_OR_EXPONENT_MISMATCH');
 const amount=input.amount_minor,subtotal=input.known_subtotal;check((amount===null||integer(amount))&&(subtotal===null||integer(subtotal)),'MINOR_UNITS_INVALID');
 const c=input.coverage;check(c&&Number.isSafeInteger(c.known_n)&&Number.isSafeInteger(c.eligible_n)&&c.known_n>=0&&c.eligible_n>=c.known_n,'COVERAGE_INVALID');
 check(['complete','partial','unavailable','not_applicable'].includes(input.status)&&typeof input.additive==='boolean'&&Array.isArray(input.missing_reasons)&&input.missing_reasons.every(text),'METRIC_STATE_INVALID');
 if(input.status==='complete')check(amount!==null&&subtotal===amount&&c.known_n===c.eligible_n&&input.missing_reasons.length===0,'COMPLETE_REQUIRES_OBSERVED_AMOUNT');
 else check(amount===null&&input.missing_reasons.length>0,'UNKNOWN_REQUIRES_REASON');
 if(c.known_n===0)check(subtotal===null||subtotal==='0','SUBTOTAL_WITHOUT_KNOWN_RECORDS');
 if(input.status==='not_applicable')check(subtotal===null&&c.known_n===0,'NOT_APPLICABLE_IS_NOT_ZERO');
 check(Array.isArray(input.provenance)&&input.provenance.length>0&&input.provenance.every(p=>p&&text(p.source)&&text(p.reference)&&text(p.version)),'PROVENANCE_REQUIRED');
 return {metric_id:input.metric_id,tenant_id:input.tenant_id,currency:input.currency,exponent,catalog_version:catalog.version,window:validateWindow(input.window),basis:input.basis,grain:input.grain,amount_minor:amount,known_subtotal:subtotal,coverage:{known_n:c.known_n,eligible_n:c.eligible_n},status:input.status,missing_reasons:[...new Set(input.missing_reasons)].sort(),provenance:ordered(input.provenance.map(p=>({source:p.source,reference:p.reference,version:p.version}))),additive:input.additive};
}
export function sumMoney(inputs,{catalog}={}){
 check(Array.isArray(inputs)&&inputs.length>0,'METRICS_REQUIRED');const rows=inputs.map(x=>validateMoney(x,catalog)),unique=new Map();for(const row of rows){check(row.additive,'NON_ADDITIVE_METRIC');check(row.status!=='not_applicable','NOT_APPLICABLE_IS_NOT_ZERO');if(unique.has(row.metric_id))check(canonical(unique.get(row.metric_id))===canonical(row),'METRIC_IDENTITY_CONFLICT');else unique.set(row.metric_id,row);}
 const items=[...unique.values()].sort((a,b)=>a.metric_id<b.metric_id?-1:a.metric_id>b.metric_id?1:0),first=items[0];
 for(const row of items)check(row.tenant_id===first.tenant_id&&row.currency===first.currency&&row.exponent===first.exponent&&row.basis===first.basis&&row.grain===first.grain,'INCOMPATIBLE_MONEY_SCOPE');
 const window=assertCompatibleWindows(items.map(x=>x.window));let amount=0n,subtotal=0n,known=0n,eligible=0n;let complete=true,subtotalKnown=false;
 for(const row of items){if(row.amount_minor===null)complete=false;else amount+=BigInt(row.amount_minor);if(row.known_subtotal!==null){subtotal+=BigInt(row.known_subtotal);if(row.coverage.known_n>0||row.status==='complete')subtotalKnown=true;}known+=BigInt(row.coverage.known_n);eligible+=BigInt(row.coverage.eligible_n);}
 check(known<=BigInt(Number.MAX_SAFE_INTEGER)&&eligible<=BigInt(Number.MAX_SAFE_INTEGER),'COVERAGE_OVERFLOW');
 return validateMoney({...first,metric_id:'sum:'+JSON.stringify(items.map(x=>x.metric_id)),window,amount_minor:complete?String(amount):null,known_subtotal:subtotalKnown?String(subtotal):null,coverage:{known_n:Number(known),eligible_n:Number(eligible)},status:complete?'complete':subtotalKnown?'partial':'unavailable',missing_reasons:complete?[]:[...new Set(items.flatMap(x=>x.missing_reasons))],provenance:items.flatMap(x=>x.provenance)},catalog);
}
function decimalRatio(rate){check(typeof rate==='string'&&rate.length<=128&&/^(0|[1-9]\d*)(\.\d{1,36})?$/.test(rate),'FX_RATE_INVALID');const [whole,fraction='']=rate.split('.');const numerator=BigInt(whole+fraction),denominator=10n**BigInt(fraction.length);check(numerator>0n,'FX_RATE_INVALID');return {numerator,denominator};}
function round(n,d,mode){const negative=n<0n,a=negative?-n:n,q=a/d,r=a%d;let magnitude=q;if(mode==='half_up'&&2n*r>=d||mode==='half_even'&&(2n*r>d||2n*r===d&&q%2n===1n))magnitude++;return String(negative?-magnitude:magnitude);}
export function convertMoney(input,{catalog,targetCurrency,fx}={}){
 const original=validateMoney(input,catalog),targetExponent=currencyExponent(catalog,targetCurrency);if(targetCurrency===original.currency){check(fx===undefined||fx===null,'FX_NOT_REQUIRED');return {original,converted:structuredClone(original),conversion:null};}
 check(fx&&fx.approved===true&&text(fx.approval_ref)&&text(fx.source)&&text(fx.version)&&fx.base===original.currency&&fx.quote===targetCurrency&&typeof fx.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(fx.date)&&['half_up','half_even','toward_zero'].includes(fx.rounding),'APPROVED_FX_REQUIRED');
 // Validate calendar via the same UTC contract, without locale-dependent parsing.
 validateWindow({start:fx.date+'T00:00:00Z',end:fx.date+'T23:59:59.999Z',timezone:'UTC',date_basis:'fx_date'});
 const rate=decimalRatio(fx.rate),numerator=rate.numerator*10n**BigInt(targetExponent),denominator=rate.denominator*10n**BigInt(original.exponent);
 const convert=value=>value===null?null:round(BigInt(value)*numerator,denominator,fx.rounding);
 const conversion={approved:true,approval_ref:fx.approval_ref,source:fx.source,date:fx.date,version:fx.version,base:fx.base,quote:fx.quote,rate:fx.rate,exact_rate:{numerator:String(rate.numerator),denominator:String(rate.denominator)},rounding:fx.rounding};
 const converted=validateMoney({...original,metric_id:original.metric_id+':fx:'+fx.version+':'+targetCurrency,currency:targetCurrency,exponent:targetExponent,amount_minor:convert(original.amount_minor),known_subtotal:convert(original.known_subtotal),provenance:[...original.provenance,{source:fx.source,reference:fx.approval_ref,version:fx.version}]},catalog);
 return {original,converted,conversion};
}
export function formatMinorUnits(amountMinor,currency,exponent,locale='es-MX'){
 check(/^[A-Z]{3}$/.test(currency)&&Number.isInteger(exponent)&&exponent>=0&&exponent<=9,'MONEY_UNIT_REQUIRED');if(amountMinor===null)return 'No disponible';check(integer(amountMinor),'MINOR_UNITS_INVALID');
 const negative=amountMinor.startsWith('-'),digits=(negative?amountMinor.slice(1):amountMinor).padStart(exponent+1,'0'),whole=exponent?digits.slice(0,-exponent):digits,fraction=exponent?digits.slice(-exponent):'';
 const integerFormat=new Intl.NumberFormat(locale,{maximumFractionDigits:0}),decimal=new Intl.NumberFormat(locale).formatToParts(1.1).find(p=>p.type==='decimal')?.value??'.';
 return (negative?'-':'')+integerFormat.format(BigInt(whole))+(exponent?decimal+fraction:'')+' '+currency;
}
export function formatMoney(input,{catalog,locale='es-MX'}={}){
 const metric=validateMoney(input,catalog),coverage=`Cobertura ${metric.coverage.known_n}/${metric.coverage.eligible_n}`;
 if(metric.status==='not_applicable')return 'No aplicable · '+coverage;
 if(metric.status==='complete')return formatMinorUnits(metric.amount_minor,metric.currency,metric.exponent,locale)+' · '+coverage;
 const subtotal=metric.known_subtotal===null?'No disponible':formatMinorUnits(metric.known_subtotal,metric.currency,metric.exponent,locale);
 return 'Total no disponible · Subtotal conocido: '+subtotal+' · '+coverage;
}
