import json,unittest
import test_runner as fixtures
class RecoveryTests(unittest.TestCase):
 def setUp(self):
  self.fx=fixtures.ControllerIntegrationTests();self.fx.setUp();self.addCleanup(self.fx.doCleanups)
 def test_dependency_receipts_are_fixed_size_and_tamper_sensitive(self):
  from unittest.mock import patch
  task={'id':'Z','depends_on':['D'],'acceptance':'tests/gate.mjs'}
  state={'D':{'status':'accepted','evidence':'x'*100000}}
  with patch.object(fixtures.r,'ROOT',self.fx.root):
   first=fixtures.r.interactive_context(task,state)['dependencies']
   self.assertLess(len(json.dumps(first)),100)
   state['D']['evidence']='changed'
   self.assertNotEqual(first,fixtures.r.interactive_context(task,state)['dependencies'])
 def failed(self):
  self.fx.worker('raise SystemExit(7)');self.fx.invoke('run','--max-rounds','2','--max-minutes','1')
 def test_recovery_requires_stop_and_reason_preserves_history(self):
  self.failed();old=self.fx.state()
  with self.assertRaisesRegex(SystemExit,'STOP'):self.fx.invoke('recover','--task','A','--approval-note','reviewed failure')
  (self.fx.root/'.runtime/STOP').touch()
  with self.assertRaisesRegex(SystemExit,'approval'):self.fx.invoke('recover','--task','A')
  self.fx.invoke('recover','--task','A','--approval-note','Operator reviewed failure; new bounded cycle authorized')
  row=self.fx.state();self.assertEqual(row['status'],'pending');self.assertEqual(row['attempts'],0)
  self.assertEqual(row['history'][-1]['attempts'],old['attempts']);self.assertEqual(row['recovery_count'],1)
  self.assertTrue((self.fx.root/'.runtime/STOP').exists())
 def test_new_attempt_keeps_recovery_history(self):
  self.failed();(self.fx.root/'.runtime/STOP').touch()
  self.fx.invoke('recover','--task','A','--approval-note','reviewed repair')
  (self.fx.root/'.runtime/STOP').unlink();self.fx.worker("Path('packages/demo/value.txt').write_text('good')")
  self.fx.invoke('run','--max-minutes','1');row=self.fx.state()
  self.assertEqual(row['recovery_count'],1)
  self.assertTrue(any(x.get('status')=='failed' for x in row['history']))
 def test_cannot_reopen_verified_or_accepted_as_if_failed(self):
  self.fx.invoke('run','--max-minutes','1');(self.fx.root/'.runtime/STOP').touch()
  with self.assertRaisesRegex(SystemExit,'failed/blocked'):self.fx.invoke('recover','--task','A','--approval-note','reason')
 def test_recovery_does_not_touch_candidate_or_baseline(self):
  self.failed();before=self.fx.state();from pathlib import Path
  source=Path(before['worktree'])/'packages/demo/value.txt';old=source.read_bytes()
  (self.fx.root/'.runtime/STOP').touch();self.fx.invoke('recover','--task','A','--approval-note','reviewed')
  self.assertEqual(source.read_bytes(),old);self.assertEqual((self.fx.root/'packages/demo/value.txt').read_text(),'bad')
if __name__=='__main__':unittest.main()
