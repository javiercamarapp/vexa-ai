import test from 'node:test';import {pathToFileURL} from 'node:url';import path from 'node:path';import {pureExam} from './pure.mjs';
test('pure product contract',async t=>pureExam(t,await import(pathToFileURL(path.join(process.env.VEXA_CANDIDATE,'packages/ingestion/mapping.mjs')))));
