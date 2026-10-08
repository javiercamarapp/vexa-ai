// Node HTTP tests execute server modules outside Next's bundler. Resolve only
// its server-only marker to the same installed Next server entry; all product
// imports and every other resolution error retain their normal behavior.
import {createRequire,registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='server-only'){
  const require=createRequire(context.parentURL);
  return {url:pathToFileURL(require.resolve('next/dist/compiled/server-only/empty.js')).href,shortCircuit:true};
 }
 return nextResolve(specifier,context);
}});
