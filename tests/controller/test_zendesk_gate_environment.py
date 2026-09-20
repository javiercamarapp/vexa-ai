"""Zendesk live gate receives only its exact credentials after an explicit attestation."""
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch
import test_runner as fixtures
r=fixtures.r
KEYS={'VEXA_ZENDESK_S02_CONFIG':'/SYNTHETIC/zendesk-config.json','VEXA_ZENDESK_TOKEN':'SYNTHETIC_ZENDESK_TOKEN','VEXA_ZENDESK_RECONCILIATION_KEY':'SYNTHETIC_ZENDESK_KEY'}
OTHER={'VEXA_HUBSPOT_TOKEN':'SYNTHETIC_OTHER_PROVIDER','VEXA_ZENDESK_APPROVAL_REFERENCE':'untrusted','OPENAI_API_KEY':'SYNTHETIC_EXCLUDED'}
NOTE='Synthetic Zendesk account authorization reference'
class ZendeskEnvironmentTests(unittest.TestCase):
 def test_provider_isolation_and_derived_reference(self):
  with patch.dict(os.environ,{**KEYS,**OTHER}):
   env=r.acceptance_environment({'id':'F03-02','requires_approval':True},{'approval_note':NOTE})
   for k,v in KEYS.items():self.assertEqual(env.get(k),v)
   self.assertEqual(env['VEXA_ZENDESK_APPROVAL_REFERENCE'],NOTE)
   self.assertNotIn('VEXA_HUBSPOT_TOKEN',env);self.assertNotIn('OPENAI_API_KEY',env)
   for task,row in [({'id':'F03-01','requires_approval':True},{'approval_note':NOTE}),({'id':'F03-02'}, {'approval_note':NOTE}),({'id':'F03-02','requires_approval':True},{}),({'id':'F03-03','requires_approval':True},{'approval_note':NOTE})]:
    self.assertFalse(set(KEYS)&r.acceptance_environment(task,row).keys())
   self.assertFalse(set(KEYS)&r.clean_environment().keys())
 def test_real_graph_stops_automatic_live_execution(self):
  t=next(t for t in r.load_graph(fixtures.ROOT/'orchestration/graph.json')['tasks'] if t['id']=='F03-02');self.assertIs(t['requires_approval'],True)
class ZendeskEnvironmentIntegrationTests(unittest.TestCase):
 setUp=fixtures.ControllerIntegrationTests.setUp
 worker=fixtures.ControllerIntegrationTests.worker
 invoke=fixtures.ControllerIntegrationTests.invoke
 def test_verify_and_clean_accept_with_synthetic_credentials_only(self):
  graph_path=self.root/'orchestration/graph.json';g=json.loads(graph_path.read_text());g['tasks'][0].update(id='F03-02',requires_approval=True);graph_path.write_text(json.dumps(g))
  expected={**KEYS,'VEXA_ZENDESK_APPROVAL_REFERENCE':NOTE};assertions=''.join(f'assert.equal(process.env[{json.dumps(k)}],{json.dumps(v)});' for k,v in expected.items())+'assert.equal(process.env.VEXA_HUBSPOT_TOKEN,undefined);assert.equal(process.env.OPENAI_API_KEY,undefined);'
  (self.root/'tests/gate.mjs').write_text(self.gate+assertions);r.git(self.root,'add','.');r.git(self.root,'commit','-qm','synthetic Zendesk gate');self.env.update({**KEYS,**OTHER})
  with patch.object(r,'run_bounded',wraps=r.run_bounded) as run:self.invoke('run','--max-rounds','1','--max-minutes','1');run.assert_not_called()
  self.invoke('prepare','--task','F03-02');sp=self.root/'.runtime/state.json';c=Path(json.loads(sp.read_text())['F03-02']['worktree']);(c/'packages/demo/value.txt').write_text('good')
  with patch.object(r,'run_bounded',wraps=r.run_bounded) as run:
   with self.assertRaisesRegex(SystemExit,'explicit operator decision'):self.invoke('verify','--task','F03-02')
   run.assert_not_called()
  self.invoke('verify','--task','F03-02','--approval-note',NOTE);self.invoke('accept','--task','F03-02');self.assertEqual(json.loads(sp.read_text())['F03-02']['status'],'accepted')
  self.assertNotIn(KEYS['VEXA_ZENDESK_TOKEN'],sp.read_text())
  for log in (self.root/'.runtime').glob('*.log'):self.assertNotIn(KEYS['VEXA_ZENDESK_TOKEN'],log.read_text())
