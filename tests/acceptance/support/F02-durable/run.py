"""Own journal/cleanup even on timeout; no writes outside support or OS TMP."""
import importlib.util, pathlib, os, subprocess, sys, json, time, uuid, hashlib
root=pathlib.Path(__file__).resolve().parents[4]
spec=importlib.util.spec_from_file_location('lifecycle',root/'tests/acceptance/support/ci/lifecycle.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
art=pathlib.Path(__file__).parent/'evidence'/('run-'+str(uuid.uuid4()));art.mkdir()
candidate=pathlib.Path(os.environ.get('VEXA_CANDIDATE',root)).resolve()
source_hashes={}
for scope in ['apps/web/src','packages/platform/src','packages/jobs','supabase/migrations']:
 for file in (candidate/scope).rglob('*'):
  if file.is_file() and file.suffix in ['.ts','.mjs','.sql'] and '/test/' not in str(file):source_hashes[str(file.relative_to(candidate))]=hashlib.sha256(file.read_bytes()).hexdigest()
(art/'sources.json').write_text(json.dumps({'candidate':str(candidate),'sha256':source_hashes},indent=2))
l=m.Lifecycle(art);l.install();child=None
try:
 child=subprocess.Popen(sys.argv[1:],cwd=root,env=l.environment(dict(os.environ,PYTHONDONTWRITEBYTECODE='1')),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
 start=time.monotonic()
 while True:
  try:out=child.communicate(timeout=1)[0];code=child.returncode;break
  except subprocess.TimeoutExpired:
   if l.cancelled or time.monotonic()-start>300:out=l.stop(child);code=128+l.cancelled if l.cancelled else 124;break
finally:
 cleanup=l.cleanup();l.restore();(art/'cleanup.json').write_text(json.dumps(cleanup,indent=2))
after={f:hashlib.sha256((candidate/f).read_bytes()).hexdigest() for f in source_hashes}
(art/'sources-after.json').write_text(json.dumps(after,indent=2))
if after!=source_hashes:
 out+='\nSOURCE_CHANGED_DURING_RUN\n';code=1
(art/'output.txt').write_text(out)
(art/'result.json').write_text(json.dumps({'argv':sys.argv[1:],'exit_code':code,'cleanup_verified':cleanup['verified']},indent=2))
print(out);print('EVIDENCE',art,'EXIT',code,'CLEANUP',cleanup['verified']);sys.exit(code if cleanup['verified'] else 2)
