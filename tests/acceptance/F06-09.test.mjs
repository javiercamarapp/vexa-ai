// Trusted gate: local SYN data only. Overall runner deadline: 900 seconds.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const candidate=process.env.VEXA_CANDIDATE;
const required=['supabase/migrations/0029_notification_outbox.sql',...['delivery','outbox','worker','reconciliation','daemon'].map(name=>'packages/notifications/'+name+'.mjs')];
const missing=required.filter(name=>!candidate||!fs.existsSync(path.join(candidate,name)));
test('F06-09 implementation exists before any infrastructure starts',()=>assert.deepEqual(missing,[],'OUTBOX_IMPLEMENTATION_MISSING'));
if(missing.length===0){
 await import('../../support/F06-outbox/independent.test.mjs');
 await import('../../support/F06-outbox/sql.test.mjs');
 await import('../../support/F06-outbox/producer-finish.test.mjs');
 await import('../../support/F06-outbox/functional.mjs');
 await import('../../support/F06-outbox/timeout-stop.mjs');
}
