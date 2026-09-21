// An ignored injected transport must fail locally, never fall through to a public service.
import {after} from 'node:test';import assert from 'node:assert/strict';
const previous=globalThis.fetch;let attempted=0;
globalThis.fetch=async()=>{attempted++;throw Error('F04_UNEXPECTED_NATIVE_FETCH');};
after(()=>{globalThis.fetch=previous;assert.equal(attempted,0,'F04_NATIVE_NETWORK_ATTEMPT');});
