import assert from 'node:assert/strict';

export function validateWebPackage(pkg){
 for(const [key,value] of Object.entries({lint:'eslint . --max-warnings=0',typecheck:'next typegen && tsc --noEmit',build:'next build --webpack'}))assert.equal(pkg.scripts[key],value,'WEB_SCRIPT_CONTRACT:'+key);
 for(const [key,value] of Object.entries({next:'16.3.6',typescript:'5.9.3',eslint:'9.39.4'}))assert.equal({...pkg.dependencies,...pkg.devDependencies}[key],value,'WEB_TOOL_VERSION');
}
