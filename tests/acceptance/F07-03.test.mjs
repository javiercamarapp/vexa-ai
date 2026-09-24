import test from 'node:test';
import {launch} from '../../support/F07-chaos/launcher.mjs';
test('F07-03 external durable chaos and recovery',{timeout:780000},()=>launch());
