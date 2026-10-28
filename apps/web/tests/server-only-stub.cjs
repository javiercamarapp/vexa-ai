/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS preload stub for tests */
// `server-only` lo resuelve Next en su empaquetado; fuera de Next (node --test) no existe como paquete. Se mapea al módulo vacío que trae Next.
const Module = require('node:module');
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return original.call(this, request === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : request, ...rest);
};
// Las hojas de estilos (globales o módulos) no se ejecutan en node --test: se importan como módulo vacío (los módulos CSS devuelven '' por clase).
Module._extensions['.css'] = (module) => { module.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : '') }); };
