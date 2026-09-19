import importlib.util
from pathlib import Path
import subprocess,tempfile,unittest
s=importlib.util.spec_from_file_location('publisher',Path(__file__).resolve().parents[2]/'orchestration/publisher.py')
p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
class PublisherTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)/'source';self.root.mkdir();self.remote=Path(self.tmp.name)/'remote.git'
  subprocess.run(['git','init','-q','-b','main',str(self.root)],check=True)
  subprocess.run(['git','init','--bare','-q',str(self.remote)],check=True)
  p.git(self.root,'config','user.name','Fixture');p.git(self.root,'config','user.email','fixture@example.invalid')
  (self.root/'.gitignore').write_text('.runtime/\n');(self.root/'code.txt').write_text('initial')
  p.git(self.root,'add','.');p.git(self.root,'commit','-qm','initial real file');p.git(self.root,'switch','-c','build')
 def change(self,value):
  (self.root/'code.txt').write_text(value);p.git(self.root,'add','.');p.git(self.root,'commit','-qm','real code increment')
 def test_push_verifies_remote_and_repeat_creates_no_commits(self):
  self.change('working');out=p.publish_git(self.root,str(self.remote));self.assertEqual(out['new_commits'],1)
  head=p.git(self.root,'rev-parse','HEAD');out2=p.publish_git(self.root,str(self.remote))
  self.assertEqual(out2['new_commits'],0);self.assertEqual(p.git(self.root,'rev-parse','HEAD'),head)
  self.assertEqual(p.git(self.root,'ls-remote',str(self.remote),'refs/heads/main').split()[0],head)
 def test_private_history_is_blocked_even_if_deleted_or_export_ignored(self):
  (self.root/'private').mkdir();(self.root/'private/secret.txt').write_text('private source')
  (self.root/'.gitattributes').write_text('private export-ignore\n')
  p.git(self.root,'add','.');p.git(self.root,'commit','-qm','fixture private history')
  (self.root/'private/secret.txt').unlink();p.git(self.root,'add','.');p.git(self.root,'commit','-qm','fixture deletion')
  with self.assertRaisesRegex(ValueError,'Private/sensitive'):p.publish_git(self.root,str(self.remote))
  self.assertEqual(p.git(self.root,'ls-remote',str(self.remote),'refs/heads/main'),'')
 def test_main_ahead_of_reviewed_build_is_never_published(self):
  self.change('reviewed');head=p.git(self.root,'rev-parse','HEAD')
  pub=self.root/'.runtime/publisher-main';pub.parent.mkdir()
  p.git(self.root,'worktree','add',str(pub),'main');p.git(pub,'merge','--ff-only',head)
  (pub/'private').mkdir();(pub/'private/synthetic.txt').write_text('unreviewed fixture')
  p.git(pub,'add','.');p.git(pub,'commit','-qm','unreviewed main increment')
  with self.assertRaises((ValueError,subprocess.CalledProcessError)):p.publish_git(self.root,str(self.remote))
  self.assertEqual(p.git(self.root,'ls-remote',str(self.remote),'refs/heads/main'),'')
 def test_push_pins_reviewed_sha_even_if_main_changes_after_check(self):
  from unittest.mock import patch
  self.change('reviewed');head=p.git(self.root,'rev-parse','HEAD');original=p.git
  def racing_git(root,*args):
   if 'push' in args:
    pub=Path(root);(pub/'private').mkdir();(pub/'private/synthetic.txt').write_text('race fixture')
    original(pub,'add','.');original(pub,'commit','-qm','concurrent unreviewed main')
   return original(root,*args)
  with patch.object(p,'git',side_effect=racing_git):out=p.publish_git(self.root,str(self.remote))
  self.assertEqual(out['sha'],head)
  self.assertNotIn('private/',p.git(self.remote,'ls-tree','-r','--name-only','main'))
 def test_dirty_source_is_never_published(self):
  (self.root/'code.txt').write_text('unreviewed')
  with self.assertRaisesRegex(ValueError,'Dirty'):p.publish_git(self.root,str(self.remote))
 def test_diverged_remote_is_not_force_pushed(self):
  self.change('first');p.publish_git(self.root,str(self.remote))
  other=Path(self.tmp.name)/'other';subprocess.run(['git','clone','-q','--branch','main',str(self.remote),str(other)],check=True)
  p.git(other,'config','user.name','Fixture');p.git(other,'config','user.email','fixture@example.invalid')
  (other/'other.txt').write_text('independent');p.git(other,'add','.');p.git(other,'commit','-qm','independent work');p.git(other,'push','origin','main')
  remote=p.git(other,'rev-parse','HEAD');self.change('second')
  with self.assertRaises(subprocess.CalledProcessError):p.publish_git(self.root,str(self.remote))
  self.assertEqual(p.git(self.root,'ls-remote',str(self.remote),'refs/heads/main').split()[0],remote)
if __name__=='__main__':unittest.main()
