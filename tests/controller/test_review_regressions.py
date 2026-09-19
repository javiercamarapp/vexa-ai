"""Regressions discovered by the clean-context reviewer, using real Git fixtures."""
import unittest
from pathlib import Path
import test_runner as fixtures
class ReviewRegressions(unittest.TestCase):
 def setUp(self):
  self.fx=fixtures.ControllerIntegrationTests();self.fx.setUp();self.addCleanup(self.fx.doCleanups)
 def prepare_good(self):
  self.fx.invoke('prepare','--task','A');p=Path(self.fx.state()['worktree'])
  (p/'packages/demo/value.txt').write_text('good');return p
 def test_rejected_verified_candidate_can_be_corrected_without_state_forgery(self):
  old=self.prepare_good();self.fx.invoke('verify','--task','A')
  (old/'packages/demo/value.txt').write_text('review correction unfinished')
  with self.assertRaises(SystemExit):self.fx.invoke('accept','--task','A')
  (self.fx.root/'.runtime/STOP').touch()
  self.fx.invoke('reject','--task','A','--approval-note','Reviewer rejected candidate; authorized correction cycle')
  self.assertEqual(self.fx.state()['status'],'pending')
  self.assertEqual(self.fx.state()['history'][-1]['status'],'verified')
  (self.fx.root/'.runtime/STOP').unlink();new=self.prepare_good();self.assertNotEqual(new,old)
  self.fx.invoke('verify','--task','A');self.fx.invoke('accept','--task','A')
  self.assertEqual(self.fx.state()['status'],'accepted')
  self.assertEqual((old/'packages/demo/value.txt').read_text(),'review correction unfinished')
 def test_recovery_never_overwrites_prior_verification_log(self):
  self.fx.invoke('prepare','--task','A')
  with self.assertRaises(SystemExit):self.fx.invoke('verify','--task','A')
  oldlog=next((self.fx.root/'.runtime').glob('*-verify.log'));before=oldlog.read_bytes()
  self.assertIn(b'ERR_ASSERTION',before)
  (self.fx.root/'.runtime/STOP').touch();self.fx.invoke('recover','--task','A','--approval-note','Cause reviewed')
  (self.fx.root/'.runtime/STOP').unlink();self.prepare_good();self.fx.invoke('verify','--task','A')
  self.assertEqual(oldlog.read_bytes(),before)
  self.assertEqual(len(list((self.fx.root/'.runtime').glob('*-verify.log'))),2)
 def test_recovery_preserves_all_worker_logs_across_cycles(self):
  self.fx.worker('print("old failed attempt"); raise SystemExit(7)')
  self.fx.invoke('run','--max-rounds','2','--max-minutes','1')
  old={p:p.read_bytes() for p in (self.fx.root/'.runtime').glob('*-agent.log')}
  (self.fx.root/'.runtime/STOP').touch();self.fx.invoke('recover','--task','A','--approval-note','Failure reviewed')
  (self.fx.root/'.runtime/STOP').unlink();self.fx.worker("Path('packages/demo/value.txt').write_text('good')")
  self.fx.invoke('run','--max-minutes','1')
  self.assertEqual(len(list((self.fx.root/'.runtime').glob('*-agent.log'))),3)
  for p,b in old.items():self.assertEqual(p.read_bytes(),b)
 def test_worker_accepts_only_content_that_also_passes_on_baseline(self):
  import subprocess,os,hashlib
  self.fx.invoke('run','--max-minutes','1');self.fx.invoke('accept','--task','A')
  result=subprocess.run(['node','--test',str(self.fx.root/'tests/gate.mjs')],env={**os.environ,'VEXA_CANDIDATE':str(self.fx.root)},capture_output=True)
  self.assertEqual(result.returncode,0)
  self.assertEqual(fixtures.r.interactive_signature(self.fx.root),self.fx.state()['verified_signature'])
  for log in self.fx.state()['logs']:
   self.assertEqual(log['sha256'],hashlib.sha256((self.fx.root/'.runtime'/log['file']).read_bytes()).hexdigest())
 def test_worker_nonportable_permissions_cannot_be_accepted(self):
  (self.fx.root/'tests/gate.mjs').write_text(self.fx.gate+'assert.equal(fs.statSync(f).mode & 0o777,0o600);')
  fixtures.r.git(self.fx.root,'add','.');fixtures.r.git(self.fx.root,'commit','-qm','nonportable mode fixture')
  self.fx.worker("Path('packages/demo/value.txt').write_text('good'); Path('packages/demo/value.txt').chmod(0o600)")
  self.fx.invoke('run','--max-minutes','1')
  with self.assertRaisesRegex(SystemExit,'clean commit'):self.fx.invoke('accept','--task','A')
  self.assertNotEqual(self.fx.state()['status'],'accepted')
 def test_interactive_nonportable_permissions_cannot_be_accepted(self):
  p=self.prepare_good();(p/'packages/demo/value.txt').chmod(0o600);self.fx.invoke('verify','--task','A')
  with self.assertRaisesRegex(SystemExit,'clean commit'):self.fx.invoke('accept','--task','A')
 def test_unchanged_baseline_mode_drift_blocks_accept(self):
  self.fx.invoke('run','--max-minutes','1');(self.fx.root/'.gitignore').chmod(0o600)
  with self.assertRaisesRegex(SystemExit,'clean commit'):self.fx.invoke('accept','--task','A')
 def test_auto_accept_also_requires_clean_materialization(self):
  import json
  gp=self.fx.root/'orchestration/graph.json';g=json.loads(gp.read_text());g['tasks'][0]['auto_accept']=True;gp.write_text(json.dumps(g))
  fixtures.r.git(self.fx.root,'add','.');fixtures.r.git(self.fx.root,'commit','-qm','auto acceptance fixture')
  self.fx.worker("Path('packages/demo/value.txt').write_text('good'); Path('packages/demo/value.txt').chmod(0o600)")
  with self.assertRaisesRegex(SystemExit,'clean commit'):self.fx.invoke('run','--auto-accept','--max-minutes','1')
  self.assertNotEqual(self.fx.state()['status'],'accepted')
 def configure_ignored_gate(self):
  (self.fx.root/'.gitignore').write_text('.runtime/\n*.scratch\n')
  (self.fx.root/'tests/gate.mjs').write_text("import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';const r=process.env.VEXA_CANDIDATE;const generated=path.join(r,'packages/demo/value.scratch');const source=path.join(r,'packages/demo/value.txt');assert.equal(fs.readFileSync(fs.existsSync(generated)?generated:source,'utf8'),'good');")
  fixtures.r.git(self.fx.root,'add','.');fixtures.r.git(self.fx.root,'commit','-qm','ignored artifact fixture')
 def test_worker_cannot_promote_uncommitted_ignored_artifact(self):
  self.configure_ignored_gate();self.fx.worker("Path('packages/demo/value.scratch').write_text('good')")
  self.fx.invoke('run','--max-minutes','1');self.assertEqual(self.fx.state()['status'],'blocked')
  with self.assertRaises(SystemExit):self.fx.invoke('accept','--task','A')
  self.assertEqual((self.fx.root/'packages/demo/value.txt').read_text(),'bad')
 def test_ignored_artifact_added_after_worker_verification_blocks_accept(self):
  self.configure_ignored_gate();self.fx.invoke('run','--max-minutes','1')
  self.assertEqual(self.fx.state()['status'],'verified')
  (Path(self.fx.state()['worktree'])/'packages/demo/value.scratch').write_text('good')
  with self.assertRaisesRegex(SystemExit,'changed after verification'):self.fx.invoke('accept','--task','A')
 def test_gate_cannot_silently_mutate_mode_in_worker_path(self):
  (self.fx.root/'tests/gate.mjs').write_text(self.fx.gate+'fs.chmodSync(f,0o600);')
  fixtures.r.git(self.fx.root,'add','.');fixtures.r.git(self.fx.root,'commit','-qm','mode mutation fixture')
  self.fx.invoke('run','--max-minutes','1');self.assertEqual(self.fx.state()['status'],'blocked')
 def test_reject_requires_stop_and_explicit_note(self):
  self.prepare_good();self.fx.invoke('verify','--task','A')
  with self.assertRaisesRegex(SystemExit,'STOP'):self.fx.invoke('reject','--task','A','--approval-note','Reviewed')
  (self.fx.root/'.runtime/STOP').touch()
  with self.assertRaisesRegex(SystemExit,'approval'):self.fx.invoke('reject','--task','A')
  self.assertEqual(self.fx.state()['status'],'verified')
 def test_reject_never_reopens_prepared_or_accepted(self):
  self.prepare_good();(self.fx.root/'.runtime/STOP').touch()
  with self.assertRaisesRegex(SystemExit,'only for verified'):self.fx.invoke('reject','--task','A','--approval-note','Reviewed')
  (self.fx.root/'.runtime/STOP').unlink();self.fx.invoke('verify','--task','A');self.fx.invoke('accept','--task','A')
  (self.fx.root/'.runtime/STOP').touch();before=self.fx.state()
  with self.assertRaisesRegex(SystemExit,'only for verified'):self.fx.invoke('reject','--task','A','--approval-note','Reviewed')
  self.assertEqual(self.fx.state(),before)
 def test_failed_recheck_log_survives_later_success(self):
  gate=self.fx.root/'tests/gate.mjs'
  gate.write_text(self.fx.gate+"assert.ok(!fs.existsSync(path.join(process.cwd(),'.runtime/fail-recheck')));")
  fixtures.r.git(self.fx.root,'add','.');fixtures.r.git(self.fx.root,'commit','-qm','recheck fixture')
  self.prepare_good();self.fx.invoke('verify','--task','A');flag=self.fx.root/'.runtime/fail-recheck';flag.touch()
  with self.assertRaisesRegex(SystemExit,'recheck failed'):self.fx.invoke('accept','--task','A')
  old=next((self.fx.root/'.runtime').glob('*-recheck.log'));before=old.read_bytes();self.assertIn(b'ERR_ASSERTION',before)
  flag.unlink();self.fx.invoke('accept','--task','A')
  self.assertEqual(old.read_bytes(),before)
  self.assertEqual(len(list((self.fx.root/'.runtime').glob('*-recheck.log'))),2)
if __name__=='__main__':unittest.main()
