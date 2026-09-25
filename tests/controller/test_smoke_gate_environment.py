"""Smoke acceptance inherits one receipt pointer, never execution inputs or cookies."""
import json,os,unittest
from pathlib import Path
from unittest.mock import patch
import test_runner as fixtures
r=fixtures.r
NOTE='SYN smoke approval reference for controller isolation only'
INPUT='/SYN/smoke-gate.json'
EXCLUDED={'VEXA_SMOKE_EXECUTION_INPUT':'/SYN/private-execution.json','VEXA_SMOKE_APPROVAL_REFERENCE':'untrusted','VEXA_RELEASE_MANIFEST':'/SYN/release.json','SUPABASE_SERVICE_ROLE_KEY':'SYN-not-a-key'}
class SmokeEnvironmentTests(unittest.TestCase):
 def test_receipt_path_and_saved_reference_only(self):
  with patch.dict(os.environ,{'VEXA_SMOKE_GATE_INPUT':INPUT,**EXCLUDED}):
   env=r.acceptance_environment({'id':'F08-02','requires_approval':True},{'approval_note':NOTE})
   self.assertEqual(env['VEXA_SMOKE_GATE_INPUT'],INPUT)
   self.assertEqual(env['VEXA_SMOKE_APPROVAL_REFERENCE'],NOTE)
   for key in EXCLUDED:
    if key!='VEXA_SMOKE_APPROVAL_REFERENCE':self.assertNotIn(key,env)
   for task,row in [({'id':'F08-01','requires_approval':True},{'approval_note':NOTE}),({'id':'F08-02'},{'approval_note':NOTE}),({'id':'F08-02','requires_approval':True},{})]:self.assertNotIn('VEXA_SMOKE_GATE_INPUT',r.acceptance_environment(task,row))
   self.assertNotIn('VEXA_SMOKE_GATE_INPUT',r.clean_environment())
class SmokeEnvironmentIntegrationTests(unittest.TestCase):
 setUp=fixtures.ControllerIntegrationTests.setUp
 worker=fixtures.ControllerIntegrationTests.worker
 invoke=fixtures.ControllerIntegrationTests.invoke
 def test_real_verify_and_accept_keep_execution_private(self):
  p=self.root/'orchestration/graph.json';g=json.loads(p.read_text());g['tasks'][0].update(id='F08-02',requires_approval=True);p.write_text(json.dumps(g))
  assertions='assert.equal(process.env.VEXA_SMOKE_GATE_INPUT,'+json.dumps(INPUT)+');assert.equal(process.env.VEXA_SMOKE_APPROVAL_REFERENCE,'+json.dumps(NOTE)+');assert.equal(process.env.VEXA_SMOKE_EXECUTION_INPUT,undefined);assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY,undefined);'
  (self.root/'tests/gate.mjs').write_text(self.gate+assertions);r.git(self.root,'add','.');r.git(self.root,'commit','-qm','SYN smoke controller fixture');self.env.update({'VEXA_SMOKE_GATE_INPUT':INPUT,**EXCLUDED})
  with patch.object(r,'run_bounded',wraps=r.run_bounded) as calls:self.invoke('run','--max-rounds','1','--max-minutes','1');calls.assert_not_called()
  self.invoke('prepare','--task','F08-02');state=self.root/'.runtime/state.json';candidate=Path(json.loads(state.read_text())['F08-02']['worktree']);(candidate/'packages/demo/value.txt').write_text('good')
  with patch.object(r,'run_bounded',wraps=r.run_bounded) as calls:
   with self.assertRaisesRegex(SystemExit,'explicit operator decision'):self.invoke('verify','--task','F08-02')
   calls.assert_not_called()
  self.invoke('verify','--task','F08-02','--approval-note',NOTE);self.invoke('accept','--task','F08-02');self.assertEqual(json.loads(state.read_text())['F08-02']['status'],'accepted')
