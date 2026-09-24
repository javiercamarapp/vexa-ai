"""Only private manifest paths and the saved approval reference reach F08-01."""
import os
import unittest
from unittest.mock import patch
import test_runner as fixtures
r=fixtures.r
KEYS={'VEXA_RELEASE_MANIFEST':'/SYN/manifest.json','VEXA_RELEASE_VERIFICATION_AUTHORIZATION':'/SYN/authorization.json'}
NOTE='SYN explicitly reviewed release identity decision'
class ReleaseEnvironmentTests(unittest.TestCase):
 def test_exact_paths_and_saved_decision_only(self):
  with patch.dict(os.environ,{**KEYS,'VEXA_RELEASE_APPROVAL_REFERENCE':'untrusted','VEXA_HUBSPOT_TOKEN':'SYN','SUPABASE_SERVICE_ROLE_KEY':'SYN'}):
   env=r.acceptance_environment({'id':'F08-01','requires_approval':True},{'approval_note':NOTE})
   for k,v in KEYS.items():self.assertEqual(env[k],v)
   self.assertEqual(env['VEXA_RELEASE_APPROVAL_REFERENCE'],NOTE)
   for k in ['VEXA_HUBSPOT_TOKEN','SUPABASE_SERVICE_ROLE_KEY']:self.assertNotIn(k,env)
   for task,row in [({'id':'F08-02','requires_approval':True},{'approval_note':NOTE}),({'id':'F08-01'}, {'approval_note':NOTE}),({'id':'F08-01','requires_approval':True},{})]:
    self.assertFalse(set(KEYS)&r.acceptance_environment(task,row).keys())
   self.assertFalse(set(KEYS)&r.clean_environment().keys())
 def test_graph_requires_approval_and_has_no_implicit_permission(self):
  task=next(t for t in r.load_graph(fixtures.ROOT/'orchestration/graph.json')['tasks'] if t['id']=='F08-01')
  self.assertIs(task['requires_approval'],True)
