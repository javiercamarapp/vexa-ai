"""Copies infrastructure to TMP before port adaptation; source remains immutable."""
import pathlib, tempfile, shutil, subprocess, os, sys, uuid, json
from completion import complete
root=pathlib.Path(__file__).resolve().parents[4]
out=pathlib.Path(tempfile.mkdtemp(prefix='f0204-external-'))
import socket
preferred=int(os.environ.get('EXAM_PORT_BASE','58010'));assert 58010<=preferred<=58047
base=None
for trial in [preferred,*range(58010,58048,3)]:
 sockets=[]
 try:
  for port in range(trial,trial+3):
   sock=socket.socket();sockets.append(sock);sock.bind(('127.0.0.1',port))
  base=trial;break
 except OSError:pass
 finally:
  for sock in sockets:sock.close()
if base is None:raise RuntimeError('INFRA_NO_FREE_CANONICAL_PORTS')
shutil.copytree(root/'tests',out/'tests')
for rel in ['tests/acceptance/support/F01-03/harness.mjs','tests/acceptance/support/F01-04/harness.mjs','tests/acceptance/support/F02-durable/isolated-infra.mjs','tests/acceptance/support/F02-durable/canonical-ports.mjs']:
 p=out/rel
 if p.exists():
  s=p.read_text()
  for old,new in [('56327',str(base)),('56328',str(base+1)),('56329',str(base+2))]:s=s.replace(old,new)
  p.write_text(s)
import importlib.util,time,hashlib
candidate=pathlib.Path(os.environ['VEXA_CANDIDATE'])
def hashes():
 return {str(p.relative_to(candidate)):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mode':p.stat().st_mode & 0o777} for scope in ['packages/ingestion','packages/platform/src','supabase/migrations'] for p in (candidate/scope).rglob('*') if p.is_file()}
before=hashes();(out/'source-before.json').write_text(json.dumps(before,sort_keys=True))
spec=importlib.util.spec_from_file_location('lifecycle',root/'tests/acceptance/support/ci/lifecycle.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
l=module.Lifecycle(out);l.install()
env=l.environment(dict(os.environ,PYTHONDONTWRITEBYTECODE='1',F02_CANONICAL_ISOLATED='1'))
env.pop('NODE_TEST_CONTEXT',None)
node=os.environ.get('EXAM_NODE','node');gate=sys.argv[1] if len(sys.argv)>1 else 'F02-04.test.mjs'
child=None
try:
 child=subprocess.Popen([node,'--test','--test-reporter=tap',str(out/'tests/acceptance'/gate)],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
 start=time.monotonic()
 while True:
  try:output=child.communicate(timeout=1)[0];code=child.returncode;break
  except subprocess.TimeoutExpired:
   if l.cancelled or time.monotonic()-start>450:output=l.stop(child);code=124;break
finally:
 cleanup=l.cleanup();l.restore();(out/'cleanup.json').write_text(json.dumps(cleanup,indent=2))
after=hashes();(out/'source-after.json').write_text(json.dumps(after,sort_keys=True))
if before!=after:code=1;output+='\nSOURCE_CHANGED\n'
if code==0 and ('# skipped 0' not in output or (gate=='F02-04.test.mjs' and not complete(output))):
 code=1;output+='\nFAKE_GREEN_INCOMPLETE\n'
(out/'output.txt').write_text(output)
(out/'result.json').write_text(json.dumps(dict(exit=code,cleanup_verified=cleanup['verified'],resources=len(cleanup['resources']),candidate=env.get('VEXA_CANDIDATE'),node=node),indent=2))
print(str(out));print(output);print('EXIT',code,'CLEANUP',cleanup['verified'])
sys.exit(code if cleanup['verified'] else 2)
