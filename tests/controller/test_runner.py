import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('runner',ROOT/'orchestration/runner.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

class ControllerTests(unittest.TestCase):
 def task(self,id='A',deps=None):
  return {'id':id,'depends_on':deps or [],'allowed_paths':['packages/demo'],'acceptance':'tests/gate.mjs'}
 def graph(self,tasks): return {'tasks':tasks,'max_attempts_per_task':2}
 def load(self,data):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'g.json';p.write_text(json.dumps(data));return r.load_graph(p)
 def test_real_graph_is_acyclic(self):
  self.assertGreater(len(r.load_graph(ROOT/'orchestration/graph.json')['tasks']),5)
 def test_cycle_rejected(self):
  with self.assertRaisesRegex(ValueError,'cycle'): self.load(self.graph([self.task('A',['B']),self.task('B',['A'])]))
 def test_missing_dependency_rejected(self):
  with self.assertRaisesRegex(ValueError,'unknown'): self.load(self.graph([self.task('A',['Z'])]))
 def test_duplicate_id_rejected(self):
  with self.assertRaisesRegex(ValueError,'duplicate'): self.load(self.graph([self.task(),self.task()]))
 def test_absolute_and_traversal_paths_rejected(self):
  for value in ['../outside','/outside','packages/../../outside','']:
   t=self.task();t['allowed_paths']=[value]
   with self.assertRaisesRegex(ValueError,'unsafe'): self.load(self.graph([t]))
 def test_verified_dependency_is_not_accepted(self):
  g=self.graph([self.task('A'),self.task('B',['A'])])
  self.assertIsNone(r.next_task(g,{'A':{'status':'verified'}}))
  self.assertEqual(r.next_task(g,{'A':{'status':'accepted'}})['id'],'B')
 def test_attempt_ceiling_and_blocked_stop_retries(self):
  for row in [{'status':'failed','attempts':2},{'status':'blocked','attempts':1}]:
   self.assertIsNone(r.next_task(self.graph([self.task()]),{'A':row}))
 def test_failed_dependency_does_not_block_independent_task(self):
  g=self.graph([self.task('A'),self.task('B',['A']),self.task('C')])
  self.assertEqual(r.next_task(g,{'A':{'status':'failed','attempts':2}})['id'],'C')
 def test_exact_paths_not_prefix_collision(self):
  self.assertTrue(r.allowed_changes(['packages/demo/a.mjs'],['packages/demo']))
  self.assertFalse(r.allowed_changes(['packages/demo-evil/a.mjs'],['packages/demo']))
  self.assertFalse(r.allowed_changes(['orchestration/graph.json'],['packages/demo']))
 def test_missing_gate_fails_closed(self):
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaises(FileNotFoundError): r.gate_path(Path(d),self.task())
 def test_gate_cannot_escape_root(self):
  t=self.task();t['acceptance']='../../gate.mjs'
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaises(ValueError): r.gate_path(Path(d),t)
 def test_api_credentials_not_inherited(self):
  with patch.dict(os.environ,{'OPENROUTER_API_KEY':'fake','OPENAI_API_KEY':'fake','SUPABASE_SERVICE_ROLE_KEY':'fake','PATH':'/bin'}):
   env=r.clean_environment()
   self.assertEqual(env['PATH'],'/bin')
   for key in ['OPENROUTER_API_KEY','OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY']: self.assertNotIn(key,env)
 def test_atomic_state_roundtrip(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'state.json';r.atomic_json(p,{'A':{'status':'failed','reason':'á'}})
   self.assertEqual(json.loads(p.read_text())['A']['reason'],'á')
   self.assertFalse(p.with_suffix('.tmp').exists())
 def test_timeout_returns_non_success(self):
  import sys
  with tempfile.TemporaryDirectory() as d:
   before=time.monotonic()
   result=r.run_bounded([sys.executable,'-c','import time; time.sleep(20)'],d,Path(d)/'log',.1)
   self.assertEqual(result,124);self.assertLess(time.monotonic()-before,5)
 def test_process_failure_propagates(self):
  import sys
  with tempfile.TemporaryDirectory() as d:
   result=r.run_bounded([sys.executable,'-c','raise SystemExit(9)'],d,Path(d)/'log',3)
   self.assertEqual(result,9)

class ControllerIntegrationTests(unittest.TestCase):
 def setUp(self):
  import shutil, subprocess, sys
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name)/'repo';self.root.mkdir()
  self.bin=Path(self.tmp.name)/'bin';self.bin.mkdir()
  (self.root/'packages/demo').mkdir(parents=True)
  (self.root/'packages/demo/value.txt').write_text('bad')
  (self.root/'tests').mkdir();(self.root/'orchestration').mkdir()
  (self.root/'.gitignore').write_text('.runtime/\n')
  (self.root/'orchestration/prompt.md').write_text('Set demo value to good.')
  self.gate="import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; const f=path.join(process.env.VEXA_CANDIDATE,'packages/demo/value.txt'); assert.equal(fs.readFileSync(f,'utf8'),'good');"
  (self.root/'tests/gate.mjs').write_text(self.gate)
  graph={'tasks':[{'id':'A','depends_on':[],'allowed_paths':['packages/demo'],'acceptance':'tests/gate.mjs','prompt':'orchestration/prompt.md','auto_accept':False}], 'max_attempts_per_task':2,'turn_timeout_seconds':10}
  (self.root/'orchestration/graph.json').write_text(json.dumps(graph))
  self.env={**os.environ,'PATH':str(self.bin)+os.pathsep+os.environ['PATH']}
  for args in [('init','-q'),('config','user.name','VEXA test'),('config','user.email','test@example.invalid'),('add','.'),('commit','-qm','fixture')]:
   subprocess.run(['git','-C',str(self.root),*args],check=True,capture_output=True)
  self.baseline=r.git(self.root,'rev-parse','HEAD')
  self.worker("Path('packages/demo/value.txt').write_text('good')")
 def worker(self,action):
  import sys
  p=self.bin/'codex'
  p.write_text('#!'+sys.executable+'\nimport sys\nfrom pathlib import Path\nif sys.argv[1:3]==["login","status"]:\n print("Logged in using ChatGPT")\nelse:\n '+action+'\n')
  p.chmod(0o755)
 def invoke(self,*args):
  import contextlib,io
  with patch.object(r,'ROOT',self.root),patch('sys.argv',['runner',*args]),patch.dict(os.environ,self.env,clear=True),contextlib.redirect_stdout(io.StringIO()):r.main()
 def state(self):return json.loads((self.root/'.runtime/state.json').read_text())['A']
 def test_authentication_is_bounded(self):
  import subprocess
  original=subprocess.run
  with patch.object(r.subprocess,'run',wraps=original) as calls:
   self.invoke('run','--max-minutes','1')
  auth=[c for c in calls.call_args_list if c.args and c.args[0][:3]==['codex','login','status']]
  self.assertEqual(len(auth),1)
  self.assertGreater(auth[0].kwargs.get('timeout',0),0)
  self.assertLessEqual(auth[0].kwargs['timeout'],60)
 def test_accept_gate_obeys_requested_budget(self):
  self.invoke('run','--max-minutes','1')
  original=r.run_bounded
  with patch.object(r,'run_bounded',wraps=original) as calls:self.invoke('accept','--task','A','--max-minutes','1')
  self.assertEqual(len(calls.call_args_list),1)
  self.assertLessEqual(calls.call_args.args[3],60)
 def test_status_does_not_write_runtime(self):
  self.invoke('status')
  self.assertFalse((self.root/'.runtime').exists())
 def test_verified_not_merged_until_explicit_accept(self):
  self.invoke('run','--max-rounds','1','--max-minutes','1')
  self.assertEqual(self.state()['status'],'verified')
  self.assertEqual((self.root/'packages/demo/value.txt').read_text(),'bad')
  self.assertEqual(r.git(self.root,'rev-parse','HEAD'),self.baseline)
  self.invoke('accept','--task','A')
  self.assertEqual(self.state()['status'],'accepted')
  self.assertEqual((self.root/'packages/demo/value.txt').read_text(),'good')
 def test_protected_change_blocks_and_preserves_baseline(self):
  self.worker("Path('tests/gate.mjs').write_text('')")
  self.invoke('run','--max-minutes','1')
  self.assertEqual(self.state()['status'],'blocked')
  self.assertEqual((self.root/'tests/gate.mjs').read_text(),self.gate)
  self.assertEqual(r.git(self.root,'rev-parse','HEAD'),self.baseline)
 def test_failed_worker_not_accepted_and_retry_ceiling(self):
  self.worker('raise SystemExit(7)')
  self.invoke('run','--max-rounds','3','--max-minutes','1')
  self.assertEqual(self.state()['status'],'failed');self.assertEqual(self.state()['attempts'],2)
  self.assertEqual(r.git(self.root,'rev-parse','HEAD'),self.baseline)
 def test_accept_rechecks_current_candidate(self):
  self.invoke('run','--max-minutes','1')
  candidate=Path(self.state()['worktree'])
  (candidate/'packages/demo/value.txt').write_text('tampered')
  with self.assertRaisesRegex(SystemExit,'changed after verification'):self.invoke('accept','--task','A')
  self.assertEqual(r.git(self.root,'rev-parse','HEAD'),self.baseline)

if __name__=='__main__':unittest.main()
