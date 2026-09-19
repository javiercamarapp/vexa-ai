"""Policy/scheduling tests never call an external model or a real cloud API."""
import importlib.util
from pathlib import Path
import unittest

s=importlib.util.spec_from_file_location('auto',Path(__file__).resolve().parents[2]/'orchestration/autoloop.py')
a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class SchedulingTests(unittest.TestCase):
 def setUp(self):
  self.g={'max_attempts_per_task':2,'tasks':[{'id':'A','depends_on':[]},{'id':'B','depends_on':['A']},{'id':'C','depends_on':[]}]}
 def test_dependency_must_be_accepted(self):
  self.assertEqual(a.select_task(self.g,{'A':{'status':'verified'}},['B','C'],{})['id'],'C')
 def test_excluded_external_task_is_never_selected(self):
  self.assertEqual(a.select_task(self.g,{},['C'],{})['id'],'C')
 def test_blocked_branch_does_not_stop_independent_local_work(self):
  self.assertEqual(a.select_task(self.g,{},['A','B','C'],{'A':'missing credential'})['id'],'C')
 def test_exhausted_task_is_not_reset(self):
  self.assertIsNone(a.select_task(self.g,{'A':{'status':'failed','attempts':2}},['A','B'],{}))
 def test_prepared_or_running_is_never_restarted(self):
  for state in ['prepared','running','verified','accepted','blocked']:
   self.assertIsNone(a.select_task(self.g,{'A':{'status':state}},['A'],{}))
 def test_review_requires_correct_task_stage_and_boolean(self):
  good={'approved':True,'task_id':'A','stage':'implementation','findings':[]}
  self.assertTrue(a.approved_review(good,'A','implementation'))
  for patch in [{'approved':'true'},{'task_id':'B'},{'stage':'gate'},{'findings':[{'severity':'P1'}]},{'findings':None}]:
   self.assertFalse(a.approved_review({**good,**patch},'A','implementation'))
 def test_p2_blocks_even_if_reviewer_says_approved(self):
  self.assertFalse(a.approved_review({'approved':True,'task_id':'A','stage':'gate','findings':[{'severity':'P2'}]},'A','gate'))
 def test_unknown_review_shape_fails_closed(self):
  for x in [None,[],{},'approved',{'approved':True}]:self.assertFalse(a.approved_review(x,'A','gate'))
class FlowTests(unittest.TestCase):
 def setUp(self):
  import test_runner as fixtures,json,shutil
  from unittest.mock import patch
  self.fx=fixtures.ControllerIntegrationTests();self.fx.setUp();self.addCleanup(self.fx.doCleanups)
  self.fx.root.joinpath('construccion').mkdir()
  (self.fx.root/'construccion/catalogo.json').write_text(json.dumps([{'id':'A','mode':'worker'}]))
  shutil.copyfile(Path(a.__file__).with_name('runner.py'),self.fx.root/'orchestration/runner.py')
  fixtures.r.git(self.fx.root,'add','.');fixtures.r.git(self.fx.root,'commit','-qm','supervisor fixture')
  self.policy={'local_task_ids':['A'],'max_minutes':1,'max_cycles':4,'max_model_calls':10}
  class FixtureLoop(a.Loop):
   def command(inner,argv,cwd,label,seconds=300,env=None):
    # Fixture has no product suites; real runner/gates/Git execute. Only these two
    # project-wide commands are substituted; live verification runs them separately.
    if label in ('bootstrap','controller-regression'):
     log=inner.log(label);log.write_text('fixture substitution');return 0,log
    return super().command(argv,cwd,label,seconds,env)
  self.loop=FixtureLoop(self.fx.root,self.policy)
  self.envpatch=patch.dict(__import__('os').environ,self.fx.env,clear=True);self.envpatch.start();self.addCleanup(self.envpatch.stop)
  self.configure_cli()
 def configure_cli(self,kind='good'):
  code="""import json,re
prompt=sys.argv[-1]
if '--output-last-message' in sys.argv:
 stage=re.search(r'stage=(gate|implementation)',prompt).group(1)
 out=sys.argv[sys.argv.index('--output-last-message')+1]
 Path(out).write_text(json.dumps({'approved':KIND!='reject','task_id':re.search(r'task_id=([A-Z0-9-]+)',prompt).group(1),'stage':stage,'findings':[],'evidence':'synthetic reviewer'}))
elif 'Eres autor de examen' in prompt:
 Path('tests').mkdir(exist_ok=True)
 Path('tests/gate.mjs').write_text(GATE)
else:
 Path('packages/demo/value.txt').write_text('bad' if KIND=='bad' else 'good')
 if KIND=='tamper':Path('tests/gate.mjs').write_text('process.exit(0)')
 if KIND=='regress':Path('packages/demo/stable.txt').write_text('bad')
""".replace('KIND',repr(kind)).replace('GATE',repr(self.fx.gate))
  self.fx.worker('exec('+repr(code)+')')
 def test_real_pipeline_accepts_only_reviewed_valid_candidate(self):
  result=self.loop.run();self.assertEqual(self.fx.state()['status'],'accepted')
  self.assertEqual((self.fx.root/'packages/demo/value.txt').read_text(),'good')
  self.assertEqual(result['model_calls'],2)
 def test_separate_author_review_and_worker_for_missing_gate(self):
  import test_runner as fixtures
  (self.fx.root/'tests/gate.mjs').unlink();fixtures.r.git(self.fx.root,'add','.');fixtures.r.git(self.fx.root,'commit','-qm','gate absent')
  result=self.loop.run();self.assertEqual(self.fx.state()['status'],'accepted');self.assertEqual(result['model_calls'],4)
 def test_two_review_rejections_never_promote_or_retry_forever(self):
  self.configure_cli('reject');result=self.loop.run()
  self.assertEqual(result['attempts']['A'],2);self.assertEqual((self.fx.root/'packages/demo/value.txt').read_text(),'bad')
  self.assertNotEqual(self.fx.state()['status'],'accepted');self.assertFalse((self.fx.root/'.runtime/STOP').exists())
 def test_worker_cannot_change_its_own_gate(self):
  self.configure_cli('tamper');result=self.loop.run()
  self.assertIn('guard',result['reason']);self.assertEqual((self.fx.root/'packages/demo/value.txt').read_text(),'bad')
 def test_budget_exhaustion_before_review_never_accepts(self):
  self.policy['max_model_calls']=1;result=self.loop.run()
  self.assertEqual(result['reason'],'model_call_budget');self.assertEqual(self.fx.state()['status'],'verified')
  self.assertEqual((self.fx.root/'packages/demo/value.txt').read_text(),'bad')
 def test_user_stop_is_not_removed(self):
  rt=self.fx.root/'.runtime';rt.mkdir();(rt/'STOP').write_text('operator pause')
  result=self.loop.run();self.assertEqual(result['model_calls'],0);self.assertEqual((rt/'STOP').read_text(),'operator pause')
 def test_gate_failure_gets_at_most_two_attempts(self):
  self.configure_cli('bad');result=self.loop.run()
  self.assertEqual(result['attempts']['A'],2);self.assertEqual(self.fx.state()['status'],'failed')
  self.assertEqual((self.fx.root/'packages/demo/value.txt').read_text(),'bad')
 def test_previous_accepted_contract_cannot_regress(self):
  import test_runner as fixtures,json
  root=self.fx.root
  (root/'packages/demo/stable.txt').write_text('good')
  (root/'tests/first.mjs').write_text(self.fx.gate.replace('value.txt','stable.txt'))
  gp=root/'orchestration/graph.json';g=json.loads(gp.read_text());task=g['tasks'][0]
  g['tasks']=[{**task,'acceptance':'tests/first.mjs'},{**task,'id':'B','depends_on':['A']}];gp.write_text(json.dumps(g))
  (root/'construccion/catalogo.json').write_text(json.dumps([{'id':x,'mode':'worker'} for x in ['A','B']]))
  fixtures.r.git(root,'add','.');fixtures.r.git(root,'commit','-qm','accepted contract fixture')
  (root/'.runtime').mkdir();(root/'.runtime/state.json').write_text(json.dumps({'A':{'status':'accepted'}}))
  self.policy['local_task_ids']=['B'];self.configure_cli('regress');out=self.loop.run()
  states=json.loads((root/'.runtime/state.json').read_text())
  self.assertNotEqual(states['B']['status'],'accepted')
  self.assertEqual((root/'packages/demo/stable.txt').read_text(),'good')
 def test_api_key_login_never_launches_a_model(self):
  p=self.fx.bin/'codex';p.write_text(p.read_text().replace('Logged in using ChatGPT','Logged in using an API key'))
  out=self.loop.run();self.assertEqual(out['model_calls'],0)
  self.assertIn('subscription_auth_required',out['reason'])
  self.assertEqual((self.fx.root/'packages/demo/value.txt').read_text(),'bad')
 def test_existing_runner_lock_blocks_gate_authoring(self):
  import fcntl,test_runner as fixtures
  rt=self.fx.root/'.runtime';rt.mkdir();before=fixtures.r.git(self.fx.root,'rev-parse','HEAD')
  with (rt/'lock').open('a+') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   with self.assertRaisesRegex(a.StopLoop,'another_controller'):self.loop.run()
  self.assertEqual(fixtures.r.git(self.fx.root,'rev-parse','HEAD'),before)
  self.assertFalse((rt/'autoloop-state.json').exists())
 def test_relaunch_does_not_renew_exhausted_task_budget(self):
  self.configure_cli('reject');first=self.loop.run();second=self.loop.run()
  self.assertEqual(first['attempts']['A'],2);self.assertEqual(second['attempts']['A'],2)
  self.assertEqual(second['model_calls'],0)
 def test_budget_renewal_requires_stop_and_explicit_review(self):
  self.configure_cli('reject');self.loop.run()
  with self.assertRaisesRegex(a.StopLoop,'note_required'):self.loop.authorize_retry('A','')
  with self.assertRaisesRegex(a.StopLoop,'STOP_required'):self.loop.authorize_retry('A','Reviewed')
  (self.fx.root/'.runtime/STOP').write_text('operator pause')
  self.loop.authorize_retry('A','Cause reviewed; one new bounded local cycle')
  self.assertTrue((self.fx.root/'.runtime/STOP').exists())
  import json
  state=json.loads((self.fx.root/'.runtime/autoloop-state.json').read_text())
  self.assertEqual(state['attempts']['A'],0);self.assertEqual(len(state['budget_renewals']),1)
 def test_gate_rejection_before_prepare_can_be_explicitly_retried(self):
  import json
  rt=self.fx.root/'.runtime';rt.mkdir();(rt/'STOP').write_text('operator pause')
  (rt/'autoloop-state.json').write_text(json.dumps({'status':'stopped','attempts':{'A':1},'blocked':{'A':'gate review rejected'}}))
  self.loop.authorize_retry('A','Gate critique reviewed; no product candidate existed')
  state=json.loads((rt/'autoloop-state.json').read_text())
  self.assertEqual(state['attempts']['A'],0);self.assertNotIn('A',state['blocked'])
  self.assertFalse((rt/'state.json').exists());self.assertTrue((rt/'STOP').exists())
 def test_stale_running_receipt_requires_review(self):
  rt=self.fx.root/'.runtime';rt.mkdir();(rt/'autoloop-state.json').write_text('{"status":"running"}')
  with self.assertRaisesRegex(a.StopLoop,'operator_review'):self.loop.run()
if __name__=='__main__':unittest.main()
