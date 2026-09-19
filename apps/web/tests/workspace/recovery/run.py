"""Real local Auth regressions; dependencies/builds only in a disposable copy."""
from pathlib import Path
import os, shutil, subprocess, tempfile

repo = Path(__file__).resolve().parents[5]
out = Path(tempfile.mkdtemp(prefix='vexa-workspace-session-'))
project = out / 'candidate'
project.mkdir()
def ignored(_directory, names):
    return [n for n in names if n in ('node_modules', '.next', '.git', '.runtime', 'private') or n.startswith('.env')]
for name in ('package.json', 'package-lock.json', 'apps', 'packages', 'supabase/migrations'):
    source = repo / name
    if source.is_dir():
        shutil.copytree(source, project / name, ignore=ignored)
    else:
        shutil.copyfile(source, project / name)
shutil.copyfile(repo / 'tests/acceptance/scaffold-copy.mjs', out / 'build-env.mjs')
shutil.copyfile(Path(__file__).with_name('session-http.mjs'), out / 'http-probe.mjs')
(out / 'empty-global-npmrc').touch()
env = {k: os.environ[k] for k in ('PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT') if k in os.environ}
env.update(CI='1', NEXT_TELEMETRY_DISABLED='1', NPM_CONFIG_USERCONFIG='/dev/null', NPM_CONFIG_GLOBALCONFIG=str(out / 'empty-global-npmrc'))
commands = [
    (['npm', 'ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], project),
    (['npm', 'run', 'lint', '--workspace', '@vexa/web'], project),
    (['npm', 'run', 'build', '--workspace', '@vexa/web'], project),
    (['npm', 'run', 'typecheck', '--workspace', '@vexa/web'], project),
    (['node', 'http-probe.mjs'], out),
]
print('Artifacts:', out, flush=True)
with (out / 'run.log').open('x') as log:
    for command, cwd in commands:
        result = subprocess.run(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=240)
        log.write('\nEXIT %s %r\n' % (result.returncode, command)); log.flush()
        if result.returncode:
            raise SystemExit(result.returncode)
print('PASS local HTTP session refresh and detail reset; no browser/provider certification')
