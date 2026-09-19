import fs from 'node:fs';
import path from 'node:path';

export function buildEnvironment(source, build) {
  const env = Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','SYSTEMROOT']
    .filter(key => source[key] !== undefined).map(key => [key, source[key]]));
  return {...env, CI:'1', NEXT_TELEMETRY_DISABLED:'1',
    NPM_CONFIG_USERCONFIG:'/dev/null', NPM_CONFIG_GLOBALCONFIG:path.join(build,'empty-global-npmrc')};
}

export function copyBuildInputs(candidate, destination) {
  for (const rel of ['package.json', 'package-lock.json', 'apps', 'packages']) {
    const source = path.join(candidate, rel);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(destination, rel), {
      recursive: true,
      filter: p => !path.relative(candidate, p).split(path.sep)
        .some(part => ['node_modules', '.next', '.git', '.runtime'].includes(part)),
    });
  }
}
