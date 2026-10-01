import {preflight} from '../../support/F06-accessibility/preflight.mjs';
preflight(process.env.VEXA_CANDIDATE);
await import('../../support/F06-accessibility/functional.mjs');
