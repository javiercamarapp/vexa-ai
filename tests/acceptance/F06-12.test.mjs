import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=process.env.VEXA_CANDIDATE;assert.ok(root,'VEXA_CANDIDATE_REQUIRED');
for(const file of ['supabase/migrations/0032_notification_business_events.sql','packages/notifications/policies.mjs','apps/web/src/app/api/notifications/delivery/route.ts','packages/notifications/hosted.mjs','apps/web/src/app/api/internal/notifications/route.ts'])assert.ok(fs.existsSync(path.join(root,file)),'BUSINESS_NOTIFICATION_IMPLEMENTATION_MISSING:'+file);
await import('../../support/F06-notification-events/functional.mjs');
