// Ayudante de pruebas (T8): registra un cargador de módulos que trata los .css como módulos vacíos, para renderizar con tsx
// componentes que importan su CSS (mocks, diagramas). Se usa con `node --import tsx --import ./_css-nulo.mjs`.
import {register} from 'node:module';
const hooks = `
export async function load(url, ctx, next) {
  if (url.endsWith('.css')) return {format: 'module', source: 'export default {};', shortCircuit: true};
  return next(url, ctx);
}`;
register('data:text/javascript,' + encodeURIComponent(hooks), import.meta.url);
