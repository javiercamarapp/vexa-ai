import test from 'node:test';import assert from 'node:assert/strict';import {assertAudit,assertPersistence,assertFocus} from './oracles.mjs';
const good={http:200,overflow:false,violations:[],incomplete:[],animations:0,unnamed:[],pageErrors:[],consoleErrors:[]};
test('causal audit rejects overflow, AA failure, unresolved contrast, motion, lost label and RSC',()=>{
 assertAudit(good);
 for(const [key,value,code] of [['overflow',true,'UI_OVERFLOW'],['violations',['contrast'],'WCAG_AA'],['incomplete',['color-contrast'],'WCAG_INCOMPLETE'],['animations',1,'REDUCED_MOTION'],['unnamed',['button'],'UNNAMED'],['pageErrors',['runtime'],'JS_PAGE'],['consoleErrors',['Failed to fetch RSC payload'],'CONSOLE_ERRORS']])assert.throws(()=>assertAudit({...good,[key]:value}),new RegExp(code));
});
test('POST success and screenshot cannot replace persistence or tenant authorization',()=>{
 const x={method:'POST',status:200,posted:{id:'SYN-A',enabled:true},stored:{id:'SYN-A',enabled:true},foreignStatus:404};assertPersistence(x);
 for(const [key,value,code] of [['method','GET','ACTION_NOT_POST'],['status',500,'ACTION_POST_FAILED'],['stored',{id:'SYN-A',enabled:false},'ACTION_NOT_PERSISTED'],['foreignStatus',200,'ACTION_TENANT_LEAK']])assert.throws(()=>assertPersistence({...x,[key]:value}),new RegExp(code));
});
test('keyboard focus must be present, visible and indicated',()=>{const x={body:false,visible:true,indicator:true};assertFocus(x);for(const [k,v]of [['body',true],['visible',false],['indicator',false]])assert.throws(()=>assertFocus({...x,[k]:v}),/KEYBOARD_FOCUS/);});
import {validateInheritance} from './coverage.mjs';
test('coverage cannot silently omit a mandatory route or pass an unresolved state',()=>{
 const required=['/overview','/problems','/problems/[id]','/customers/[id]','/recommendations','/explorer','/interventions','/briefs/[id]','/login','/notifications','/settings/notifications'];
 const states=()=>Object.fromEntries(['loading','error','empty','partial','stale','ready'].map(s=>[s,{resolution:'not_applicable',reason:'SYN calibration only',contractSource:'SYN contract'}]));
 const ledger=[...required,...Array.from({length:21},(_,i)=>'/SYN-supplement-'+i)].map(route=>({route,requiredByF0607:required.includes(route),states:states(),sources:[]}));
 validateInheritance({candidate:'unused',root:'unused',ledger,bindings:{files:{}}});
 const missing=structuredClone(ledger);missing[0].requiredByF0607=false;assert.throws(()=>validateInheritance({ledger:missing}),/MANDATORY_ROUTE_MISSING/);
 const unresolved=structuredClone(ledger);unresolved[0].states.loading={status:'pass'};assert.throws(()=>validateInheritance({ledger:unresolved}),/UNADJUDICATED_STATE/);
 const invented=structuredClone(ledger);invented[0].states.loading={resolution:'inherited',reviewer:'SYN',assertion:'SYN',receiptPath:'missing'};assert.throws(()=>validateInheritance({ledger:invented,bindings:{files:{}}}),/UNPINNED_STATE_RECEIPT/);
});
