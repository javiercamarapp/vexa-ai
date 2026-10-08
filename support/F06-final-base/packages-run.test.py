import importlib.util, io, json, pathlib, tempfile, tarfile, unittest
from unittest.mock import patch
HERE=pathlib.Path(__file__).resolve().parent

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,HERE/file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
runner=load('packages_runner','packages-run.py');proxy=load('packages_proxy','packages-docker.py')
NAME='vexa-schema-review-12345678-1234-1234-1234-123456789abc'
ARGS=['run','--pull','never','--network','none','--name',NAME,'-d','-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.159']
class Calibration(unittest.TestCase):
    def test_proxy_only_adds_ownership_flags_and_reserves_before_exec(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);(root/'resources.jsonl').touch(mode=0o600)
            result=proxy.prepare(ARGS,root,'SYN-broker')
            self.assertEqual(result[5:],ARGS[1:]);self.assertEqual(result[:5],['run','--cidfile',str(root/(NAME+'.cid')),'--label','rovaq.packages.broker=SYN-broker'])
            row=json.loads((root/'resources.jsonl').read_text());self.assertEqual(row,{'name':NAME,'cidfile':NAME+'.cid','broker':'SYN-broker'})
            other=['exec','-i',NAME,'psql'];self.assertIs(proxy.prepare(other,root,'SYN-broker'),other)
    def test_proxy_rejects_different_target_network_or_image(self):
        for index,value in [(4,'host'),(6,'unowned'),(10,'other-image')]:
            bad=list(ARGS);bad[index]=value
            with self.assertRaises(ValueError):proxy.prepare(bad,pathlib.Path('/unused'),'SYN')
    def test_archive_rejects_links_private_and_traversal_before_writing(self):
        for name,kind in [('private/capture',tarfile.REGTYPE),('../escape',tarfile.REGTYPE),('/escape',tarfile.REGTYPE),('apps/.env.local',tarfile.REGTYPE),('link',tarfile.SYMTYPE)]:
            stream=io.BytesIO()
            with tarfile.open(fileobj=stream,mode='w') as t:
                item=tarfile.TarInfo(name);item.type=kind;t.addfile(item)
            stream.seek(0)
            with tarfile.open(fileobj=stream) as t,self.assertRaises(ValueError):runner.checked_members(t)
    def test_cleanup_checks_captured_id_absence_and_does_not_delete_foreign(self):
        class Result:
            def __init__(self,code,out='',err=''):self.returncode=code;self.stdout=out;self.stderr=err
        for foreign in [False,True]:
            with self.subTest(foreign=foreign),tempfile.TemporaryDirectory() as tmp:
                root=pathlib.Path(tmp);runner.write_json(root/'resources.jsonl',{})
                (root/'resources.jsonl').write_text(json.dumps({'name':NAME,'cidfile':NAME+'.cid','broker':'SYN'})+'\n')
                (root/(NAME+'.cid')).write_text('a'*64)
                calls=[]
                def fake(argv,**kwargs):
                    calls.append(argv)
                    return Result(0,'a'*64+'|/'+NAME+'|OTHER') if foreign else Result(1,err='Error: No such container')
                with patch.object(runner.subprocess,'run',fake):result=runner.cleanup(root,'SYN','/fake/docker')
                self.assertEqual(result['verified'],not foreign);self.assertFalse(any('rm' in c for c in calls))
                if not foreign:self.assertEqual([c[3] for c in calls],['a'*64,'a'*64,NAME])
    def test_eperm_only_benign_when_group_independently_absent(self):
        with patch.object(runner.os,'killpg',side_effect=PermissionError),patch.object(runner,'group_absent',return_value=True):self.assertFalse(runner.signal_group(123,9))
        with patch.object(runner.os,'killpg',side_effect=PermissionError),patch.object(runner,'group_absent',return_value=False),self.assertRaises(PermissionError):runner.signal_group(123,9)
    def test_actual_local_process_group_is_absent_after_exit(self):
        import subprocess,sys
        child=subprocess.Popen([sys.executable,'-c','pass'],start_new_session=True);child.wait(timeout=5)
        self.assertTrue(runner.group_absent(child.pid))

    def test_receipt_only_without_id_is_not_cleanup_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);runner.write_json(root/'resources.jsonl',{})
            (root/'resources.jsonl').write_text(json.dumps({'name':NAME,'cidfile':NAME+'.cid','broker':'SYN'})+'\n')
            result=type('Result',(),{'returncode':1,'stderr':'No such container','stdout':''})()
            with patch.object(runner.subprocess,'run',return_value=result):out=runner.cleanup(root,'SYN','/fake/docker')
            self.assertFalse(out['verified']);self.assertEqual(out['resources'][0]['error'],'NO_CAPTURED_RESOURCE_ID')
if __name__=='__main__':unittest.main()
