"""Ownership regressions: synthetic decoys only; no product correctness claim."""
import importlib.util,json,os,pathlib,subprocess,sys,tempfile,unittest
here=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('preview_scratch',here/'scratch.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Ownership(unittest.TestCase):
    def test_owned_allocations_removed(self):
        owner=m.Scratch();p=owner.allocate('next','f0203-next-');(p/'synthetic').write_text('fixture')
        self.assertTrue(owner.cleanup()['verified']);self.assertFalse(p.exists())
    def test_replaced_symlink_refused(self):
        owner=m.Scratch();p=owner.allocate('next','f0203-next-')
        with tempfile.TemporaryDirectory(prefix='f0203-next-decoy-',dir='/tmp') as d:
            marker=pathlib.Path(d)/'synthetic';marker.write_text('preserve')
            p.rmdir();p.symlink_to(d,target_is_directory=True)
            try:
                self.assertFalse(owner.cleanup()['verified']);self.assertEqual(marker.read_text(),'preserve')
            finally:p.unlink()
    def test_child_manifest_cannot_delete_foreign_directory(self):
        for code in (0,1):
            with self.subTest(exit=code),tempfile.TemporaryDirectory(prefix='f0203-next-decoy-',dir='/tmp') as d:
                marker=pathlib.Path(d)/'synthetic';marker.write_text('preserve')
                script="import os,json,pathlib,sys;pathlib.Path(os.environ['F02_PREVIEW_ARTIFACTS'],'scratch.json').write_text(json.dumps([sys.argv[1]]));sys.exit(int(sys.argv[2]))"
                result=subprocess.run([sys.executable,'-B',str(here/'run.py'),sys.executable,'-B','-c',script,d,str(code)],text=True,capture_output=True,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'},timeout=30)
                self.assertEqual(result.returncode,code,result.stdout+result.stderr);self.assertEqual(marker.read_text(),'preserve')
                line=next(x for x in result.stdout.splitlines() if x.startswith('EVIDENCE '));art=pathlib.Path(line.split(' ')[1])
                cleanup=json.loads((art/'cleanup.json').read_text());self.assertTrue(cleanup['verified']);self.assertTrue(cleanup['scratch_absent'])
                allocations=json.loads((art/'owned-scratch.json').read_text());self.assertEqual(set(allocations),{'next','pg'})
                self.assertTrue(all(not os.path.lexists(x) for x in allocations.values()))
if __name__=='__main__':unittest.main()
