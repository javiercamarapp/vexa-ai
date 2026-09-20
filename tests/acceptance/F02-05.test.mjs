import test from 'node:test';
import {launch} from './support/F02-durable-final/launcher.mjs';
test('F02-05 ENTRYDIRECT complete external durable contract',{timeout:800000},()=>launch('F02-05'));
