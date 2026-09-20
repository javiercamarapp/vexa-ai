#!/usr/bin/env python3
"""Synthetic local lifecycle regressions; Docker images must already exist."""
import json, os, pathlib, shutil, signal, socket, subprocess, sys, tempfile, time, unittest, uuid
ROOT=pathlib.Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'tests/acceptance/support/ci'))
import run
from lifecycle import Lifecycle
ART=pathlib.Path(tempfile.mkdtemp(prefix='f0105-lifecycle-green-'));ART.chmod(0o700)
NODE=shutil.which('node'); evidence=[]
def save(p,value):
    with open(p,'w',opener=lambda p,f:os.open(p,f,0o600)) as f:f.write(json.dumps(value,indent=2))
def docker(*args):return subprocess.run(['docker',*args],capture_output=True,text=True,timeout=30)
def absent(kind,name):
    r=docker(kind,'inspect',name);return r.returncode!=0 and ('No such' in r.stderr or r.stderr.strip()=='Error response from daemon: network '+name+' not found')
class Tests(unittest.TestCase):
    def area(self):
        p=ART/self._testMethodName;p.mkdir(mode=0o700);return p
    def fixture(self,p,normal=False,module='F01-03/harness.mjs'):
        file=p/'fixture.mjs'
        file.write_text("import fs from 'node:fs';import {spawn,spawnSync} from 'node:child_process';import {launch} from "+json.dumps((ROOT/'tests/acceptance/support'/module).as_uri())+";const h=await launch();try{if(h.sql('SELECT 42')!=='42')throw Error('DB_NOT_REAL');const db=h.sql(`SELECT pg_read_file('/etc/hostname')`).trim();const inspect=spawnSync('docker',['container','inspect',db,'--format','{{json .HostConfig.PortBindings}}'],{encoding:'utf8'});if(inspect.status!==0||inspect.stdout.trim()!=='{}')throw Error('DB_PUBLISHED');fs.writeFileSync("+json.dumps(str(p/'ready'))+",'ready',{mode:0o600});"+("" if normal else "const c=spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});require('net').createServer().listen(0,'127.0.0.1',function(){require('fs').writeFileSync(process.argv[1],JSON.stringify({pid:process.pid,port:this.address().port}),{mode:0o600})});setInterval(()=>{},1000)\","+json.dumps(str(p/'descendant'))+"],{stdio:'ignore'});await new Promise(r=>setTimeout(r,60000));")+"}finally{h.close();}")
        file.chmod(0o600);return file
    def check_cleanup(self,cleanup):
        self.assertTrue(cleanup['verified'],cleanup)
        self.assertGreaterEqual(len(cleanup['resources']),2)
        for e in cleanup['resources']:self.assertTrue(absent(e['kind'],e['name']))
        self.assertEqual(pathlib.Path(cleanup['journal']).stat().st_mode&0o777,0o600)
    def check_descendant(self,p):
        d=json.loads((p/'descendant').read_text())
        for _ in range(60):
            try:os.kill(d['pid'],0)
            except ProcessLookupError:break
            time.sleep(.05)
        else:self.fail('descendant PID still exists')
        with socket.socket() as s:s.bind(('127.0.0.1',d['port']))
    def test_timeout_real_db(self):
        p=self.area();f=self.fixture(p);records=[]
        with self.assertRaises(run.JobFailure) as ex:run.execute([NODE,str(f)],ROOT,dict(os.environ),p,records,timeout=15)
        self.assertEqual(ex.exception.code,124);self.assertEqual(json.loads((p/'00.command.json').read_text())['exit_code'],124);self.assertTrue((p/'ready').exists());self.check_cleanup(records[-1]['cleanup']);self.check_descendant(p)
        evidence.append({'test':self._testMethodName,'records':records})
    def test_normal_real_db(self):
        p=self.area();f=self.fixture(p,normal=True);records=[]
        run.execute([NODE,str(f)],ROOT,dict(os.environ),p,records,timeout=30)
        self.check_cleanup(records[-1]['cleanup']);evidence.append({'test':self._testMethodName,'records':records})
    def test_normal_f04_db(self):
        p=self.area();f=self.fixture(p,normal=True,module='F01-04/services.mjs');records=[]
        run.execute([NODE,str(f)],ROOT,dict(os.environ),p,records,timeout=30)
        self.check_cleanup(records[-1]['cleanup']);evidence.append({'test':self._testMethodName,'records':records})
    def signal_case(self,sig):
        p=self.area();f=self.fixture(p);bin=p/'bin';bin.mkdir();scratch=p/'scratch';scratch.mkdir();candidate=p/'candidate';candidate.mkdir()
        wrapper=bin/'node';wrapper.write_text('#!/bin/sh\nif [ "$1" = "--version" ]; then echo v26.7.0; exit 0; fi\nexec '+shlex_quote(NODE)+' '+shlex_quote(str(f))+'\n');wrapper.chmod(0o700)
        env=dict(os.environ,PATH=str(bin)+':'+os.environ['PATH'],TMPDIR=str(scratch))
        log=p/'launcher.log'
        with open(log,'w',opener=lambda p,f:os.open(p,f,0o600)) as out:
            child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tests/acceptance/support/ci/run.py'),'--job','web-quality','--candidate',str(candidate)],env=env,stdout=out,stderr=out)
            try:
                for _ in range(300):
                    if (p/'descendant').exists():break
                    if child.poll() is not None:break
                    time.sleep(.1)
                self.assertTrue((p/'descendant').exists(),log.read_text())
                child.send_signal(sig);self.assertEqual(child.wait(timeout=30),128+sig)
            finally:
                if child.poll() is None:child.send_signal(signal.SIGTERM);child.wait(timeout=30)
        receipts=list(scratch.rglob('receipt.json'));self.assertEqual(len(receipts),1)
        receipt=json.loads(receipts[0].read_text());self.assertEqual(receipt['status'],'cancelled');self.check_cleanup(receipt['cleanup']);self.check_descendant(p)
        self.assertEqual(receipts[0].stat().st_mode&0o777,0o600);evidence.append({'test':self._testMethodName,'receipt':str(receipts[0])})
    def test_parent_term(self):self.signal_case(signal.SIGTERM)
    def test_parent_int(self):self.signal_case(signal.SIGINT)
    def test_foreign_preserved(self):
        p=self.area();life=Lifecycle(p);name='vexa-f01-03-'+str(uuid.uuid4());foreign=str(uuid.uuid4())
        net=docker('network','create','--label','vexa.ci.broker='+foreign,name);self.assertEqual(net.returncode,0,net.stderr)
        cid=None
        try:
            r=docker('create','--pull','never','--name',name+'-db','--network',name,'--label','vexa.ci.broker='+foreign,'public.ecr.aws/supabase/postgres:17.6.1.159');self.assertEqual(r.returncode,0,r.stderr);cid=r.stdout.strip()
            with life.journal.open('a') as f:
                for kind,n in [('container',name+'-db'),('network',name)]:f.write(json.dumps({'kind':kind,'name':n,'broker':life.broker})+'\n')
            result=life.cleanup();self.assertFalse(result['verified']);self.assertEqual(docker('container','inspect',cid).returncode,0);self.assertEqual(docker('network','inspect',net.stdout.strip()).returncode,0)
            evidence.append({'test':self._testMethodName,'cleanup':result,'foreign_preserved':True})
        finally:
            if cid:self.assertEqual(docker('rm','-f','-v',cid).returncode,0)
            self.assertEqual(docker('network','rm',net.stdout.strip()).returncode,0)
    def test_malformed_fail_closed(self):
        life=Lifecycle(self.area());life.journal.write_text('{bad\n');self.assertFalse(life.cleanup()['verified'])
    def test_signal_before_popen(self):
        p=self.area();life=Lifecycle(p);life.cancelled=signal.SIGTERM;records=[]
        with self.assertRaises(run.JobFailure) as ex:run.execute([NODE,'-e','process.exit(99)'],ROOT,dict(os.environ),p,records,lifecycle=life)
        self.assertEqual(ex.exception.code,143);self.assertTrue(records[0]['cleanup']['verified'])
    def test_signal_during_popen(self):
        from unittest.mock import patch
        p=self.area();life=Lifecycle(p);records=[];original=subprocess.Popen
        def start(*args,**kwargs):
            child=original(*args,**kwargs);os.kill(os.getpid(),signal.SIGTERM);return child
        life.install()
        try:
            with patch.object(run.subprocess,'Popen',start):
                with self.assertRaises(run.JobFailure) as ex:run.execute([NODE,'-e','setInterval(()=>{},1000)'],ROOT,dict(os.environ),p,records,lifecycle=life)
            self.assertEqual(ex.exception.code,143);self.assertTrue(records[0]['process_cleanup_verified'])
        finally:life.restore()
    def test_daemon_failure_blocks(self):
        from unittest.mock import patch
        life=Lifecycle(self.area());name='vexa-f01-03-'+str(uuid.uuid4())
        life.journal.write_text(json.dumps({'kind':'network','name':name,'broker':life.broker})+'\n')
        with patch('lifecycle.subprocess.run',return_value=subprocess.CompletedProcess([],1,'','Cannot connect to Docker daemon')):
            self.assertFalse(life.cleanup()['verified'])
    def test_cleanup_failure_blocks_success(self):
        p=self.area();life=Lifecycle(p);life.journal.write_text('broken\n');records=[]
        with self.assertRaises(run.JobFailure) as ex:run.execute([NODE,'-e','process.exit(0)'],ROOT,dict(os.environ),p,records,lifecycle=life)
        self.assertEqual(ex.exception.code,1);self.assertFalse(records[0]['cleanup']['verified'])
    def test_build_env_excludes_journal(self):
        module=(ROOT/'tests/acceptance/scaffold-copy.mjs').as_uri()
        r=subprocess.run([NODE,'--input-type=module','-e',f"import {{buildEnvironment}} from '{module}';const e=buildEnvironment({{PATH:'fixture',VEXA_CI_JOURNAL:'private',VEXA_CI_BROKER:'private'}},'/tmp');if('VEXA_CI_JOURNAL' in e||'VEXA_CI_BROKER' in e)process.exit(1)"],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr)
def shlex_quote(s):
    import shlex
    return shlex.quote(s)
if __name__=='__main__':
    try:result=unittest.main(exit=False,verbosity=2).result
    finally:save(ART/'evidence.json',evidence);print('ARTIFACTS='+str(ART))
    # unittest.main(exit=False) does not communicate failure by itself.
    sys.exit(0 if result.wasSuccessful() else 1)
