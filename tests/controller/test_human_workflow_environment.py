"""Private human-workflow evidence is passed only to explicitly approved gates."""
import os, unittest
from unittest.mock import patch
import test_runner as fixtures
r=fixtures.r
TASKS=['F07-05','F08-03','F08-05']
KEYS=['VEXA_HUMAN_WORKFLOW_MANIFEST','VEXA_HUMAN_WORKFLOW_REVIEW','VEXA_HUMAN_WORKFLOW_REVIEW_SHA256','VEXA_HUMAN_WORKFLOW_APPROVAL_REFERENCE']
class HumanWorkflowEnvironmentTests(unittest.TestCase):
 def test_saved_operator_reference_and_only_review_inputs(self):
  values=dict(zip(KEYS,['/SYN/manifest','/SYN/review','a'*64,'UNTRUSTED']))
  with patch.dict(os.environ,{**values,'SUPABASE_SERVICE_ROLE_KEY':'SYN-never-forward','VEXA_SMOKE_EXECUTION_INPUT':'/SYN/foreign'}):
   for task in TASKS:
    env=r.acceptance_environment({'id':task,'requires_approval':True},{'approval_note':'SYN saved operator decision'})
    for key in KEYS[:-1]:self.assertEqual(env[key],values[key])
    self.assertEqual(env[KEYS[-1]],'SYN saved operator decision')
    self.assertNotIn('SUPABASE_SERVICE_ROLE_KEY',env)
    self.assertNotIn('VEXA_SMOKE_EXECUTION_INPUT',env)
 def test_no_authority_or_different_task_has_no_inputs(self):
  with patch.dict(os.environ,{key:'SYN-input' for key in KEYS}):
   for task in TASKS:
    for approval in ['',None,False,{},'  ']:
     self.assertFalse(set(KEYS)&r.acceptance_environment({'id':task,'requires_approval':True},{'approval_note':approval}).keys())
    for flag in [False,None,1]:
     self.assertFalse(set(KEYS)&r.acceptance_environment({'id':task,'requires_approval':flag},{'approval_note':'SYN decision'}).keys())
   self.assertFalse(set(KEYS)&r.acceptance_environment({'id':'F08-04','requires_approval':True},{'approval_note':'SYN decision'}).keys())
   self.assertFalse(set(KEYS)&r.clean_environment().keys())
 def test_graph_keeps_approval_and_dependencies(self):
  graph=r.load_graph(fixtures.ROOT/'orchestration/graph.json')
  for task in TASKS:
   row=next(t for t in graph['tasks'] if t['id']==task)
   self.assertIs(row['requires_approval'],True)
   self.assertTrue(row['depends_on'])
