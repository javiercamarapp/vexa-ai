import test from 'node:test';
import {launch} from '../../support/F07-load/launcher.mjs';
test('F07-04 independent10K50K150K actual ingestion measurements',{timeout:7350000},()=>launch());
