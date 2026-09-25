"""Permissions acceptance inherits two private paths and only the saved operator note."""
import json,os,unittest
from pathlib import Path
from unittest.mock import patch
import test_runner as fixtures
r=fixtures.r
NOTE='SYN permissions approval reference for controller isolation only'
INPUT='/SYN/permissions-manifest.json'
AUTH='/SYN/permissions-authorization.json'
EXCLUDED={'VEXA_SMOKE_EXECUTION_INPUT':'/SYN/private-execution.json','VEXA_PERMISSIONS_APPROVAL_REFERENCE':'untrusted','VEXA_RELEASE_MANIFEST':'/SYN/release.json','SUPABASE_SERVICE_ROLE_KEY':'SYN-not-a-key'}
class PermissionsEnvironmentTests(unittest.TestCase):
 def test_receipt_path_and_saved_reference_only(self):
  with patch.dict(os.environ,{'VEXA_PERMISSIONS_MANIFEST':INPUT,'VEXA_PERMISSIONS_AUTHORIZATION':AUTH,**EXCLUDED}):
   env=r.acceptance_environment({'id':'F08-04','requires_approval':True},{'approval_note':NOTE})
   self.assertEqual(env['VEXA_PERMISSIONS_MANIFEST'],INPUT)
   self.assertEqual(env['VEXA_PERMISSIONS_AUTHORIZATION'],AUTH)
   self.assertEqual(env['VEXA_PERMISSIONS_APPROVAL_REFERENCE'],NOTE)
   for key in EXCLUDED:
    if key!='VEXA_PERMISSIONS_APPROVAL_REFERENCE':self.assertNotIn(key,env)
   keys={'VEXA_PERMISSIONS_MANIFEST','VEXA_PERMISSIONS_AUTHORIZATION','VEXA_PERMISSIONS_APPROVAL_REFERENCE'}
   cases=[({'id':'F08-01','requires_approval':True},{'approval_note':NOTE}),({'id':'F08-04'},{'approval_note':NOTE}),({'id':'F08-04','requires_approval':1},{'approval_note':NOTE})]
   cases.extend(({'id':'F08-04','requires_approval':True},{'approval_note':note}) for note in ['', '  ', None, False, 1, {}])
   for task,row in cases:self.assertFalse(keys&r.acceptance_environment(task,row).keys())
   self.assertFalse(keys&r.clean_environment().keys())
 def test_graph_requires_real_operator_decision(self):
  task=next(t for t in r.load_graph(fixtures.ROOT/'orchestration/graph.json')['tasks'] if t['id']=='F08-04')
  self.assertIs(task['requires_approval'],True)
class PermissionsEnvironmentIntegrationTests(unittest.TestCase):
 setUp=fixtures.ControllerIntegrationTests.setUp
 worker=fixtures.ControllerIntegrationTests.worker
 invoke=fixtures.ControllerIntegrationTests.invoke
 def test_real_verify_and_accept_keep_execution_private(self):
  p=self.root/'orchestration/graph.json';g=json.loads(p.read_text());g['tasks'][0].update(id='F08-04',requires_approval=True);p.write_text(json.dumps(g))
  assertions='assert.equal(process.env.VEXA_PERMISSIONS_MANIFEST,'+json.dumps(INPUT)+');assert.equal(process.env.VEXA_PERMISSIONS_AUTHORIZATION,'+json.dumps(AUTH)+');assert.equal(process.env.VEXA_PERMISSIONS_APPROVAL_REFERENCE,'+json.dumps(NOTE)+');assert.equal(process.env.VEXA_SMOKE_EXECUTION_INPUT,undefined);assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY,undefined);'
  (self.root/'tests/gate.mjs').write_text(self.gate+assertions);r.git(self.root,'add','.');r.git(self.root,'commit','-qm','SYN permissions controller fixture');self.env.update({'VEXA_PERMISSIONS_MANIFEST':INPUT,'VEXA_PERMISSIONS_AUTHORIZATION':AUTH,**EXCLUDED})
  with patch.object(r,'run_bounded',wraps=r.run_bounded) as calls:self.invoke('run','--max-rounds','1','--max-minutes','1');calls.assert_not_called()
  self.invoke('prepare','--task','F08-04');state=self.root/'.runtime/state.json';candidate=Path(json.loads(state.read_text())['F08-04']['worktree']);(candidate/'packages/demo/value.txt').write_text('good')
  with patch.object(r,'run_bounded',wraps=r.run_bounded) as calls:
   with self.assertRaisesRegex(SystemExit,'explicit operator decision'):self.invoke('verify','--task','F08-04')
   calls.assert_not_called()
  self.invoke('verify','--task','F08-04','--approval-note',NOTE);self.invoke('accept','--task','F08-04');self.assertEqual(json.loads(state.read_text())['F08-04']['status'],'accepted')
