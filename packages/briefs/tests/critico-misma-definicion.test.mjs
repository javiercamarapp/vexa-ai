import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CATEGORIA_CRITICA_FUENTE} from '../../workspace-service/critico.mjs';
test('el Brief nuevo usa la definición única de crítico y excluye ruido como Problemas',()=>{
 const b=readFileSync(new URL('../index.mjs',import.meta.url),'utf8'),e=readFileSync(new URL('../../recommendations/explorer.mjs',import.meta.url),'utf8');
 assert.match(b,/import \{esSenalCritica\} from '..\/workspace-service\/critico\.mjs'/);
 assert.match(e,/CATEGORIA_CRITICA_FUENTE/);assert.doesNotMatch(e,/safety\|privacy\|fraud/);
 assert.match(b,/separarRuido\(view\.items/);assert.ok(CATEGORIA_CRITICA_FUENTE.includes('privacy'));
});
