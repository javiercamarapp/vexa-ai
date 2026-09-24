// Public source identities only; this module performs no filesystem access.
export const runtimeCodePaths=Object.freeze(['packages/gateway/index.mjs','packages/gateway/budget.mjs','packages/gateway/catalog.mjs','packages/intelligence/index.mjs']);
export function validRuntimeCode(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===runtimeCodePaths.length&&runtimeCodePaths.every(p=>typeof value[p]==='string'&&/^[a-f0-9]{64}$/.test(value[p]));}
export function sameRuntimeCode(a,b){return validRuntimeCode(a)&&validRuntimeCode(b)&&runtimeCodePaths.every(p=>a[p]===b[p]);}
// Next replaces this expression at BUILD time. Server environment changes cannot
// relabel that compiled artifact. Uncompiled consumers must pass their own
// source identity, computed by runtime-code-files.mjs at process startup.
export function compiledRuntimeCode(){try{const value=JSON.parse(process.env.VEXA_COMPILED_EXTRACTION_CODE??'null');return validRuntimeCode(value)?value:null;}catch{return null;}}
