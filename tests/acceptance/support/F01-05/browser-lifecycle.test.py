"""Real UI browser survives its controller only until broker recovery."""
import json, pathlib, shutil, subprocess, sys, tempfile, time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'ci'))
from lifecycle import Lifecycle
from run import environment
control=pathlib.Path(__file__).resolve().parents[4]
artifacts=pathlib.Path(tempfile.mkdtemp(prefix='f0105-browser-lifecycle-'))
meta=artifacts/'browser.json'; script=artifacts/'browser.mjs'; life=Lifecycle(artifacts)
script.write_text("import fs from 'node:fs';import {prepare} from "+json.dumps((control/'tests/acceptance/support/F01-04/harness.mjs').as_uri())+";const h=await prepare("+json.dumps(str(control))+");fs.writeFileSync("+json.dumps(str(meta))+",JSON.stringify({container:h.container,tmp:h.tmp}),{mode:0o600});setInterval(()=>{},1000);")
child=subprocess.Popen(['node',str(script)],env=life.environment(environment(artifacts,control)),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
resource_id=None; details=None; result={}
try:
 deadline=time.monotonic()+90
 while not meta.exists() and child.poll() is None and time.monotonic()<deadline:time.sleep(.1)
 assert meta.exists(),'INFRA_BROWSER_NOT_READY'
 details=json.loads(meta.read_text())
 resource_id=subprocess.check_output(['docker','container','inspect',details['container'],'--format','{{.Id}}'],text=True).strip()
 life.stop(child)
 result=life.cleanup()
 assert any(e['name']==details['container'] for e in result['resources']),'BROWSER_NOT_JOURNALED'
 assert result['verified'],'BROWSER_RECOVERY_NOT_VERIFIED'
 assert subprocess.run(['docker','container','inspect',resource_id],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0,'BROWSER_SURVIVED'
 print('PASS: actual UI browser journaled, controller stopped, browser removed by owner')
finally:
 if child.poll() is None:life.stop(child)
 # Explicit fixture ID only, including red-run recovery; no prefix sweep.
 if resource_id:subprocess.run(['docker','container','rm','-f','-v',resource_id],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 (artifacts/'cleanup.json').write_text(json.dumps(result,indent=2)+'\n')
 if details:
  scratch=pathlib.Path(details['tmp']).resolve();assert scratch.name.startswith('vexa-f01-04-') and scratch.parent==pathlib.Path(tempfile.gettempdir()).resolve()
  shutil.rmtree(scratch)
 print('evidence',artifacts)
