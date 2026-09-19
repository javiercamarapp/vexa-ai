import fs from 'node:fs';
import path from 'node:path';

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
