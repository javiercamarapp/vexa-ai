import assert from 'node:assert/strict';
import {rejectsDomain,money,safeExport,status,queued} from './oracles.mjs';
const [defect,flag]=process.argv.slice(2),bad=flag==='1';
try{
 switch(defect){
 case 'ambiguous': await rejectsDomain(async()=>({coverage:{accepted:bad?1:0,rejected:bad?0:1},errors:bad?[]:[{line:2,field:'date',code:'AMBIGUOUS_DATE'}]}),'AMBIGUOUS_DATE');break;
 case 'null_zero':money({money:bad?{amount_minor:'0',currency:'USD',exponent:2}:null},null);break;
 case 'jpy_rounding':await rejectsDomain(async()=>({coverage:{accepted:bad?1:0,rejected:bad?0:1},errors:bad?[]:[{line:2,field:'amount',code:'MONEY_FRACTION'}]}),'JPY_NO_ROUNDING');break;
 case 'csv_formula':safeExport('line,field,code\r\n2,'+(bad?'=1+1':"'=1+1")+',BAD\r\n',1);break;
 case 'cas_ignored':status({status:bad?200:409},409,'CAS_STALE');break;
 case 'tenant_header':status({status:bad?200:403},403,'TENANT_SELECTOR_FORGED');break;
 case 'tenant_body':status({status:bad?200:400},400,'TENANT_BODY_FORGED');break;
 case 'queued_completed':queued({state:bad?'completed':'queued'});break;
 default:throw Error('META_UNKNOWN_CASE');
 }
}catch(e){if(e.code==='ERR_ASSERTION')assert.fail('ORACLE_'+defect+': '+e.message);throw e;}
