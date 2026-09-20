"""Scratch-only launcher. Existing harness files are read-only; no source receipts."""
import os, sys, pathlib, tempfile, shutil, socket, importlib.util, subprocess, json, hashlib, time
root=pathlib.Path(__file__).resolve().parents[4]
candidate=pathlib.Path(os.environ.get('VEXA_CANDIDATE',root)).resolve()
art=pathlib.Path(tempfile.mkdtemp(prefix='f0203-gate-'))
spec=importlib.util.spec_from_file_location('lifecycle',root/'tests/acceptance/support/ci/lifecycle.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
l=m.Lifecycle(art);l.install()
ss=importlib.util.spec_from_file_location('preview_scratch',pathlib.Path(__file__).with_name('scratch.py'))
sm=importlib.util.module_from_spec(ss);ss.loader.exec_module(sm)
owned=sm.Scratch()
def hashes():
 result={}
 for scope in ['apps','packages','supabase','tests/acceptance','orchestration']:
  for p in (candidate/scope).rglob('*'):
   if any(x in p.parts for x in ['node_modules','.next','__pycache__']):continue
   if p.is_file() and not p.is_symlink():result[str(p.relative_to(candidate))]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mode':p.stat().st_mode&0o777}
 return result
before=hashes();(art/'sources-before.json').write_text(json.dumps(before,sort_keys=True))
held=[];ports=[]
try:
 for port in range(57950,57990):
  s=socket.socket()
  try:s.bind(('127.0.0.1',port));held.append(s);ports.append(port)
  except OSError:s.close()
  if len(ports)==6:break
 if len(ports)<6:raise RuntimeError('SETUP_PORTS_UNAVAILABLE')
 support=art/'support';support.mkdir()
 for name in ['F02-durable','F01-03','ci']:
  dest=support/name;dest.mkdir()
  for p in (root/'tests/acceptance/support'/name).iterdir():
   if p.is_file() and p.suffix in ['.mjs','.json']:shutil.copyfile(p,dest/p.name)
 for p in (support/'F02-durable').glob('*.mjs'):
  text=p.read_text()
  # The F01 fixture uses 1MiB; F02's contractual boundary requires real Storage to permit 20MiB.
  text=text.replace('FILE_SIZE_LIMIT:1048576','FILE_SIZE_LIMIT:20971520')
  for old,new in zip([56327,56328,56329],ports):text=text.replace(str(old),str(new))
  # Keep full real Auth session available to browser adapters; never written to receipts.
  text=text.replace('return {id:r.data.user.id,token:r.data.access_token};','return {id:r.data.user.id,token:r.data.access_token,session:r.data};')
  p.write_text(text)
 env=l.environment(dict(os.environ,PYTHONDONTWRITEBYTECODE='1',VEXA_CANDIDATE=str(candidate),F02_PREVIEW_ISOLATED='1',F02_PREVIEW_HARNESS=str(support/'F02-durable'),F02_PREVIEW_PORTS=json.dumps(ports),F02_PREVIEW_ARTIFACTS=str(art)))
 # A nested node --test must not inherit the outer runner's internal context.
 env.pop('NODE_TEST_CONTEXT',None)
 env['F02_PREVIEW_NEXT_DIR']=str(owned.allocate('next','f0203-next-'))
 env['F02_PREVIEW_PG_DIR']=str(owned.allocate('pg','f0203-pg-'))
 (art/'owned-scratch.json').write_text(json.dumps({k:str(v) for k,v in owned.paths.items()}))
 for s in held:s.close()
 held=[]
 output_file=open(art/'output.txt','x')
 child=subprocess.Popen(sys.argv[1:],cwd=root,env=env,stdout=output_file,stderr=subprocess.STDOUT,text=True,start_new_session=True)
 start=time.monotonic()
 while child.poll() is None:
  if l.cancelled or time.monotonic()-start>360:
   l.stop(child);break
  time.sleep(.2)
 code=child.returncode if child.returncode is not None else 124
 output_file.close();print((art/'output.txt').read_text())

except Exception as e:
 code=2;print('SETUP_FAILED',type(e).__name__)
finally:
 for s in held:s.close()
 cleanup=l.cleanup();l.restore()
 scratch_result=owned.cleanup()
 cleanup['scratch_absent']=scratch_result['scratch_absent']
 cleanup['scratch_errors']=scratch_result['scratch_errors']
 cleanup['verified']=cleanup['verified'] and scratch_result['verified']
 after=hashes();(art/'sources-after.json').write_text(json.dumps(after,sort_keys=True))
 (art/'cleanup.json').write_text(json.dumps(cleanup,indent=2))
 if before!=after:code=1;print('SOURCE_CHANGED')
 if not cleanup['verified']:code=2
 (art/'result.json').write_text(json.dumps({'argv':sys.argv[1:],'exit_code':code,'source_unchanged':before==after,'cleanup_verified':cleanup['verified'],'state':'EXECUTED_PASS_PENDING_REVIEW' if code==0 else 'EXECUTED_FAIL'},indent=2))
 print('EVIDENCE',art,'EXIT',code,'CLEANUP',cleanup['verified']);sys.exit(code)
