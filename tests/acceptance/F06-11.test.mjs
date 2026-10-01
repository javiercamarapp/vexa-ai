import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=process.env.VEXA_CANDIDATE;assert.ok(root,'VEXA_CANDIDATE_REQUIRED');
for(const file of ['packages/notifications/push.mjs','packages/notifications/push-config.mjs','supabase/migrations/0031_push_subscriptions.sql','apps/web/public/service-worker.js','apps/web/src/app/api/notifications/push/route.ts'])assert.ok(fs.existsSync(path.join(root,file)),'PUSH_IMPLEMENTATION_MISSING:'+file);
await import('../../support/F06-push/functional.mjs');
