import assert from 'node:assert/strict';
export function assertIncomplete(incomplete,resolved=[]){
 assert.ok(incomplete.every(rule=>Array.isArray(rule?.nodes)),'WCAG_INCOMPLETE_REQUIRES_ADJUDICATION');
 const nodes=incomplete.flatMap(rule=>rule.nodes.map(node=>({rule:rule.id,...node})));assert.equal(resolved.length,nodes.length,'WCAG_INCOMPLETE_REQUIRES_ADJUDICATION');
 for(const node of nodes){const matches=resolved.filter(r=>r.rule===node.rule&&r.target===node.target[0]&&r.html===node.html);assert.equal(matches.length,1,'WCAG_EXACT_RESOLUTION_REQUIRED');const r=matches[0];assert.equal(node.rule,'color-contrast');assert.equal(r.status,'resolved_current_native_measurement');assert.ok(Number.isFinite(r.ratio)&&r.ratio>=4.5,'NATIVE_TEXT_CONTRAST_BELOW_AA');assert.ok(r.visible&&r.unoccluded,'NATIVE_CONTRAST_NOT_VISIBLE');assert.equal(r.foreground?.alpha,1);assert.equal(r.background?.alpha,1);}
}
export function assertAudit(row){
 assert.equal(row.http,200,'UI_HTTP');assert.equal(row.overflow,false,'UI_OVERFLOW');
 assert.deepEqual(row.violations,[],'WCAG_AA_VIOLATIONS');assertIncomplete(row.incomplete,row.incompleteResolved);
 assert.equal(row.animations,0,'REDUCED_MOTION');assert.equal(row.unnamed.length,0,'UNNAMED_CONTROLS');
 assert.deepEqual(row.pageErrors,[],'JS_PAGE_ERRORS');assert.deepEqual(row.consoleErrors,[],'CONSOLE_ERRORS_INCLUDING_RSC');
}
export function assertPersistence({method,status,posted,stored,foreignStatus}){
 assert.equal(method,'POST','ACTION_NOT_POST');assert.equal(status,200,'ACTION_POST_FAILED');assert.deepEqual(stored,posted,'ACTION_NOT_PERSISTED');assert.ok([403,404].includes(foreignStatus),'ACTION_TENANT_LEAK');
}
export function assertFocus(x){assert.equal(x.body,false,'KEYBOARD_FOCUS_LOST');assert.equal(x.visible,true,'KEYBOARD_FOCUS_OFFSCREEN');assert.equal(x.indicator,true,'KEYBOARD_FOCUS_INVISIBLE');}
