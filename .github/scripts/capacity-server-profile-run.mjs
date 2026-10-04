// Separate entry: instrumentation must finish ESM evaluation before the adapted run imports it.
import {runProfile} from './capacity-server-profile.mjs';
await runProfile();
