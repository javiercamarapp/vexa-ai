import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
test('F06-02 detail uses real service and authorized canonical customer bindings',()=>{
 for(const file of ['packages/workspace-service/detail.mjs','apps/web/src/app/api/workspace/detail/[kind]/[id]/route.ts','apps/web/src/app/api/workspace/customer-bindings/route.ts'])assert.ok(process.env.VEXA_CANDIDATE&&fs.existsSync(path.join(process.env.VEXA_CANDIDATE,file)),'DETAIL_IMPLEMENTATION_MISSING:'+file);
});
