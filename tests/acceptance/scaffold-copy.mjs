import fs from 'node:fs';
import path from 'node:path';

export function buildEnvironment(source, build) {
  const env = Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','SYSTEMROOT']
    .filter(key => source[key] !== undefined).map(key => [key, source[key]]));
  return {...env, CI:'1', NEXT_TELEMETRY_DISABLED:'1',
    NPM_CONFIG_USERCONFIG:'/dev/null', NPM_CONFIG_GLOBALCONFIG:path.join(build,'empty-global-npmrc')};
}

export function copyBuildInputs(candidate, destination) {
  if (fs.lstatSync(destination,{throwIfNoEntry:false})?.isSymbolicLink()) throw new Error('BUILD_DESTINATION_SYMLINK');
  let ancestor=path.resolve(destination); const suffix=[];
  while (!fs.lstatSync(ancestor,{throwIfNoEntry:false})) {
    suffix.unshift(path.basename(ancestor)); ancestor=path.dirname(ancestor);
  }
  const input=fs.realpathSync(candidate), output=path.join(fs.realpathSync(ancestor),...suffix);
  const contains=(a,b)=>b===a || b.startsWith(a+path.sep);
  if (contains(input,output) || contains(output,input)) throw new Error('BUILD_DESTINATION_OVERLAP');
  fs.mkdirSync(destination, {recursive:true});
  const writable=p=>{
    const stat=fs.lstatSync(p);
    if (stat.isSymbolicLink()) throw new Error('BUILD_INPUT_SYMLINK');
    if (stat.isDirectory()) {
      fs.chmodSync(p,0o755);
      for (const name of fs.readdirSync(p)) writable(path.join(p,name));
    } else fs.chmodSync(p,stat.mode & 0o111 ? 0o755 : 0o644);
  };
  for (const rel of ['package.json', 'package-lock.json', 'apps', 'packages']) {
    const source = path.join(candidate, rel), target=path.join(destination,rel);
    if (fs.existsSync(target) || fs.lstatSync(target,{throwIfNoEntry:false})) throw new Error('BUILD_DESTINATION_EXISTS');
    if (fs.lstatSync(source,{throwIfNoEntry:false})) {
      fs.cpSync(source,target,{
        recursive:true,
        filter:p=>{
          if (path.relative(candidate,p).split(path.sep)
            .some(part=>['node_modules','.next','.git','.runtime'].includes(part))) return false;
          const stat=fs.lstatSync(p);
          if (stat.isSymbolicLink()) throw new Error('BUILD_INPUT_SYMLINK');
          if (!stat.isFile() && !stat.isDirectory()) throw new Error('BUILD_INPUT_TYPE');
          return true;
        },
      });
      writable(target);
    }
  }
}
