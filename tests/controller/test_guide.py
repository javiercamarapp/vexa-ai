import importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('guide',ROOT/'scripts/guide.py')
g=importlib.util.module_from_spec(s);s.loader.exec_module(g)
class GuideTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.r=Path(self.tmp.name)
  (self.r/'input.md').write_text('contract')
  self.card={'id':'A','reads':['input.md'],'deliverables':['packages/a.mjs'],'steps':['a','b','c'],'oracles':['x','y','z'],'recovery':'preserve','mode':'worker','depends_on':[],'allowed_paths':['packages'],'acceptance':'gate.mjs','objective':'thing'}
  self.graph={'tasks':[self.card]}
 def test_missing_gate_is_not_ready_but_complete_spec(self):
  out=g.audit(self.r,self.graph,[self.card]);self.assertEqual(out['errors'],[]);self.assertEqual(out['missing_gates'],['A']);self.assertFalse(out['ready'])
 def test_missing_card_rejected(self):self.assertTrue(g.audit(self.r,self.graph,[])['errors'])
 def test_duplicate_card_rejected(self):self.assertTrue(g.audit(self.r,self.graph,[self.card,self.card])['errors'])
 def test_missing_input_rejected(self):
  self.card['reads']=['absent.md'];self.assertTrue(g.audit(self.r,self.graph,[self.card])['errors'])
 def test_unwritable_output_rejected(self):
  self.card['deliverables']=['root.json'];self.assertTrue(g.audit(self.r,self.graph,[self.card])['errors'])
 def test_traversal_rejected(self):
  self.card['deliverables']=['../outside'];self.card['allowed_paths']=['..'];self.assertTrue(g.audit(self.r,self.graph,[self.card])['errors'])
 def test_worker_cannot_write_control_even_if_allowlisted(self):
  self.card['deliverables']=['tests/acceptance/gate.mjs'];self.card['allowed_paths']=['tests'];self.assertTrue(g.audit(self.r,self.graph,[self.card])['errors'])
 def test_oracle_omitted_rejected(self):
  self.card['oracles']=[];self.assertTrue(g.audit(self.r,self.graph,[self.card])['errors'])
 def test_blank_gate_not_ready(self):
  (self.r/'gate.mjs').write_text('');self.assertFalse(g.audit(self.r,self.graph,[self.card])['ready'])
 def test_existing_gate_is_not_product_pass(self):
  (self.r/'gate.mjs').write_text("import './external-contract.mjs';")
  out=g.audit(self.r,self.graph,[self.card]);self.assertTrue(out['ready']);self.assertFalse(out['product_verified'])
 def test_cycles_rejected(self):
  self.card['depends_on']=['A'];self.assertTrue(g.audit(self.r,self.graph,[self.card])['errors'])
 def test_packet_contains_specific_oracles_and_blocker(self):
  text=g.packet(self.r,self.card);self.assertIn('MISSING',text);self.assertIn('preserve',text);self.assertIn('packages/a.mjs',text)
if __name__=='__main__':unittest.main()
