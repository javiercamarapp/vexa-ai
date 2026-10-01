import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
export function preflight(candidate){
 assert.ok(candidate,'F0607_CANDIDATE_REQUIRED');
 for(const file of ['apps/web/src/components/workspace/shared-panel.tsx','apps/web/src/components/workspace/detail-panel.tsx','apps/web/src/components/notifications/panel.tsx','apps/web/src/app/(workspace)/settings/notification-delivery/page.tsx'])assert.ok(fs.existsSync(path.join(candidate,file)),'F0607_IMPLEMENTATION_MISSING:'+file);
}
