/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS preload stub for tests */
// `server-only` lo resuelve Next en su empaquetado; fuera de Next (node --test) no existe como paquete. Se mapea al módulo vacío que trae Next.
const Module = require('node:module');
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return original.call(this, request === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : request, ...rest);
};
