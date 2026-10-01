import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=process.env.VEXA_CANDIDATE;assert.ok(root,'VEXA_CANDIDATE_REQUIRED');
for(const file of ['packages/notifications/email.mjs','packages/notifications/receipts.mjs','supabase/migrations/0030_notification_email.sql','apps/web/src/app/api/webhooks/email/route.ts'])assert.ok(fs.existsSync(path.join(root,file)),'EMAIL_IMPLEMENTATION_MISSING:'+file);
await import('../../support/F06-email/functional.mjs');
