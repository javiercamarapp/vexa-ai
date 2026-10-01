import assert from 'node:assert/strict';
export function assertAudit(row){
 assert.equal(row.http,200,'UI_HTTP');assert.equal(row.overflow,false,'UI_OVERFLOW');
 assert.deepEqual(row.violations,[],'WCAG_AA_VIOLATIONS');
 assert.deepEqual(row.incomplete,[],'WCAG_INCOMPLETE_REQUIRES_ADJUDICATION');
 assert.equal(row.animations,0,'REDUCED_MOTION');assert.equal(row.unnamed.length,0,'UNNAMED_CONTROLS');
 assert.deepEqual(row.pageErrors,[],'JS_PAGE_ERRORS');assert.deepEqual(row.consoleErrors,[],'CONSOLE_ERRORS_INCLUDING_RSC');
}
export function assertPersistence({method,status,posted,stored,foreignStatus}){
 assert.equal(method,'POST','ACTION_NOT_POST');assert.equal(status,200,'ACTION_POST_FAILED');
 assert.deepEqual(stored,posted,'ACTION_NOT_PERSISTED');assert.ok([403,404].includes(foreignStatus),'ACTION_TENANT_LEAK');
}
export function assertFocus(x){assert.equal(x.body,false,'KEYBOARD_FOCUS_LOST');assert.equal(x.visible,true,'KEYBOARD_FOCUS_OFFSCREEN');assert.equal(x.indicator,true,'KEYBOARD_FOCUS_INVISIBLE');}
