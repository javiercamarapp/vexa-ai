// CLI/build only. Do not import this module from the web verifier.
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {runtimeCodePaths} from './runtime-code.mjs';
export function readRuntimeCode(){return Object.fromEntries(runtimeCodePaths.map(name=>{const url=new URL('../../../'+name,import.meta.url);const file=fileURLToPath(url),stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('CANDIDATE_RUNTIME_SOURCE_INVALID');return[name,createHash('sha256').update(readFileSync(file)).digest('hex')];}));}
