"""Own journal/cleanup even on timeout; no writes outside support or OS TMP."""
import importlib.util, pathlib, os, subprocess, sys, json, time
root=pathlib.Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('lifecycle',root/'tests/acceptance/support/ci/lifecycle.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
art=pathlib.Path(__file__).parent/'evidence'/('run-'+str(time.time_ns()));art.mkdir()
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
(art/'output.txt').write_text(out)
(art/'result.json').write_text(json.dumps({'argv':sys.argv[1:],'exit_code':code,'cleanup_verified':cleanup['verified']},indent=2))
print(out);print('EVIDENCE',art,'EXIT',code,'CLEANUP',cleanup['verified']);sys.exit(code if cleanup['verified'] else 2)
