import test from 'node:test';import {httpExam} from './http.mjs';
test('real HTTP product contract',()=>httpExam(process.env.VEXA_CANDIDATE));
