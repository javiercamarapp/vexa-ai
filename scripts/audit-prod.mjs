// `npm run audit:prod`: npm audit de produccion; falla (salida distinta de 0) con vulnerabilidades altas o criticas.
// Se lanza npm con el entorno limpio de npm_config_allow_scripts: npm 11 lo exporta a los hijos de `npm run` cuando viene de un .npmrc de usuario y el npm hijo lo rechaza (EALLOWSCRIPTS).
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {...process.env};
delete env.npm_config_allow_scripts;
const r = spawnSync('npm', ['audit', '--omit=dev', '--audit-level=high'], {cwd: raiz, env, stdio: 'inherit'});
process.exit(r.status ?? 1);
