"""Closure gate inherits only two private paths and the saved operator reference."""
import json,os,unittest
from pathlib import Path
from unittest.mock import patch
import test_runner as fixtures
r=fixtures.r
NOTE='SYN closure approval reference for controller isolation only'
INPUT='/SYN/closure-dossier.json'
AUTH='/SYN/closure-authorization.json'
EXCLUDED={'VEXA_SMOKE_EXECUTION_INPUT':'/SYN/private-execution.json','VEXA_CLOSURE_APPROVAL_REFERENCE':'untrusted','VEXA_RELEASE_MANIFEST':'/SYN/release.json','SUPABASE_SERVICE_ROLE_KEY':'SYN-not-a-key'}
class ClosureEnvironmentTests(unittest.TestCase):
 def test_receipt_path_and_saved_reference_only(self):
  with patch.dict(os.environ,{'VEXA_CLOSURE_DOSSIER':INPUT,'VEXA_CLOSURE_AUTHORIZATION':AUTH,**EXCLUDED}):
   env=r.acceptance_environment({'id':'F08-06','requires_approval':True},{'approval_note':NOTE})
   self.assertEqual(env['VEXA_CLOSURE_DOSSIER'],INPUT)
   self.assertEqual(env['VEXA_CLOSURE_AUTHORIZATION'],AUTH)
   self.assertEqual(env['VEXA_CLOSURE_APPROVAL_REFERENCE'],NOTE)
   for key in EXCLUDED:
    if key!='VEXA_CLOSURE_APPROVAL_REFERENCE':self.assertNotIn(key,env)
   for task,row in [({'id':'F08-01','requires_approval':True},{'approval_note':NOTE}),({'id':'F08-06'},{'approval_note':NOTE}),({'id':'F08-06','requires_approval':True},{})]:self.assertNotIn('VEXA_CLOSURE_DOSSIER',r.acceptance_environment(task,row))
   self.assertNotIn('VEXA_CLOSURE_DOSSIER',r.clean_environment())
   self.assertNotIn('VEXA_CLOSURE_AUTHORIZATION',r.clean_environment())
   for note in ['', '   ', None, False, 1, {}]:
    env=r.acceptance_environment({'id':'F08-06','requires_approval':True},{'approval_note':note})
    self.assertFalse(any(k.startswith('VEXA_CLOSURE_') for k in env))
   for approved in [False, 'true', 1, None]:
    env=r.acceptance_environment({'id':'F08-06','requires_approval':approved},{'approval_note':NOTE})
    self.assertFalse(any(k.startswith('VEXA_CLOSURE_') for k in env))
class ClosureEnvironmentIntegrationTests(unittest.TestCase):
 setUp=fixtures.ControllerIntegrationTests.setUp
 worker=fixtures.ControllerIntegrationTests.worker
 invoke=fixtures.ControllerIntegrationTests.invoke
 def test_real_verify_and_accept_keep_execution_private(self):
  p=self.root/'orchestration/graph.json';g=json.loads(p.read_text());g['tasks'][0].update(id='F08-06',requires_approval=True);p.write_text(json.dumps(g))
  assertions='assert.equal(process.env.VEXA_CLOSURE_AUTHORIZATION,'+json.dumps(AUTH)+');assert.equal(process.env.VEXA_CLOSURE_DOSSIER,'+json.dumps(INPUT)+');assert.equal(process.env.VEXA_CLOSURE_APPROVAL_REFERENCE,'+json.dumps(NOTE)+');assert.equal(process.env.VEXA_SMOKE_EXECUTION_INPUT,undefined);assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY,undefined);'
  (self.root/'tests/gate.mjs').write_text(self.gate+assertions);r.git(self.root,'add','.');r.git(self.root,'commit','-qm','SYN closure controller fixture');self.env.update({'VEXA_CLOSURE_DOSSIER':INPUT,'VEXA_CLOSURE_AUTHORIZATION':AUTH,**EXCLUDED})
  with patch.object(r,'run_bounded',wraps=r.run_bounded) as calls:self.invoke('run','--max-rounds','1','--max-minutes','1');calls.assert_not_called()
  self.invoke('prepare','--task','F08-06');state=self.root/'.runtime/state.json';candidate=Path(json.loads(state.read_text())['F08-06']['worktree']);(candidate/'packages/demo/value.txt').write_text('good')
  with patch.object(r,'run_bounded',wraps=r.run_bounded) as calls:
   with self.assertRaisesRegex(SystemExit,'explicit operator decision'):self.invoke('verify','--task','F08-06')
   calls.assert_not_called()
  self.invoke('verify','--task','F08-06','--approval-note',NOTE);self.invoke('accept','--task','F08-06');self.assertEqual(json.loads(state.read_text())['F08-06']['status'],'accepted')
