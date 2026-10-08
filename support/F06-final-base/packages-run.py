#!/usr/bin/env python3
"""Separate local regression of the exact 55 package .test.mjs files, never acceptance."""
import argparse, hashlib, json, os, pathlib, re, shutil, signal, subprocess, sys, tarfile, tempfile, time, uuid
HERE=pathlib.Path(__file__).resolve().parent

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def git(root,*args):return subprocess.check_output(['git','-C',str(root),*args],text=True).strip()
def checked_members(archive):
    members=archive.getmembers()
    for m in members:
        p=pathlib.PurePosixPath(m.name)
        if p.is_absolute() or '..' in p.parts or not p.parts or any(x in {'private','.git','node_modules','.next','.runtime'} or x.startswith('.env') for x in p.parts):raise ValueError('ARCHIVE_PRIVATE_OR_PATH')
        if not(m.isfile() or m.isdir()):raise ValueError('ARCHIVE_TYPE')
    return members

def tree(root, commit):
    data=subprocess.check_output(['git','-C',str(root),'ls-tree','-r','-z',commit])
    result={}
    for row in data.split(b'\0'):
        if not row:continue
        metadata,name=row.split(b'\t',1);mode,kind,blob=metadata.decode().split()
        if kind!='blob' or mode not in ('100644','100755'):raise ValueError('SOURCE_TREE_TYPE')
        result[name.decode()]=(mode,blob)
    return result

def inventory(root):return {str(p.relative_to(root)):sha(p) for p in sorted((root/'packages').rglob('*.test.mjs')) if 'node_modules' not in p.parts}
def write_json(path,value):
    with open(path,'w',opener=lambda p,f:os.open(p,f,0o600)) as f:json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())

def group_absent(pgid):
    result=subprocess.run(['ps','-axo','pid=,pgid='],capture_output=True,text=True,timeout=5)
    rows=[line.split() for line in result.stdout.splitlines() if line.strip()]
    if result.returncode or not rows or any(len(row)!=2 or not all(x.isdigit() for x in row) for row in rows):raise ValueError('PROCESS_INVENTORY_FAILED')
    return not any(int(row[1])==pgid for row in rows)

def signal_group(pgid,sig):
    try:os.killpg(pgid,sig)
    except ProcessLookupError:return False
    except PermissionError:
        if not group_absent(pgid):raise
        return False
    return True

def cleanup(directory,broker,docker):
    result={'verified':False,'resources':[]}
    def call(args):return subprocess.run([docker,*args],capture_output=True,text=True,timeout=15)
    def inspect(target):
        r=call(['container','inspect',target,'--format','{{.Id}}|{{.Name}}|{{ index .Config.Labels "rovaq.packages.broker" }}'])
        if r.returncode:
            if re.search(r'No such (object|container)',r.stderr,re.I):return None
            raise ValueError('INSPECT_FAILED')
        rid,name,owner=r.stdout.strip().split('|');return rid,name.lstrip('/'),owner
    try:
        journal=directory/'resources.jsonl'
        if journal.is_symlink() or journal.stat().st_mode&0o777!=0o600:raise ValueError('JOURNAL_MODE')
        entries=[json.loads(line) for line in journal.read_text().splitlines()]
        names=set()
        for e in entries:
            if set(e)!={'name','cidfile','broker'} or e['broker']!=broker or not re.fullmatch(r'vexa-schema-(syn|review)-[a-f0-9-]{36}',e['name']) or e['cidfile']!=e['name']+'.cid' or e['name'] in names:raise ValueError('JOURNAL_INVALID')
            names.add(e['name'])
        for e in entries:
            item={'name':e['name'],'id':None,'absent':False};result['resources'].append(item)
            try:
                cidfile=directory/e['cidfile']
                if cidfile.is_symlink():raise ValueError('CID_SYMLINK')
                rid=cidfile.read_text().strip() if cidfile.exists() else None
                if rid is not None and not re.fullmatch('[a-f0-9]{64}',rid):raise ValueError('CID_INVALID')
                actual=inspect(rid or e['name'])
                if actual:
                    actual_id,name,owner=actual
                    if not re.fullmatch('[a-f0-9]{64}',actual_id) or name!=e['name'] or owner!=broker or (rid and actual_id!=rid):raise ValueError('OWNERSHIP_MISMATCH')
                    rid=actual_id
                    if call(['container','rm','-f','-v',rid]).returncode:raise ValueError('REMOVE_FAILED')
                item['id']=rid
                if rid is None:raise ValueError('NO_CAPTURED_RESOURCE_ID')
                if inspect(rid) is not None or inspect(e['name']) is not None:raise ValueError('RESOURCE_REMAINS')
                item['absent']=True
            except Exception as ex:item['error']=str(ex)
        result['verified']=all(x['absent'] for x in result['resources'])
    except Exception as ex:result['error']=str(ex)
    return result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--candidate',required=True,type=pathlib.Path);ap.add_argument('--artifacts',required=True,type=pathlib.Path);args=ap.parse_args()
    candidate=args.candidate.resolve();artifacts=args.artifacts.absolute()
    if artifacts.exists() or artifacts.is_symlink():ap.error('artifacts must be new')
    if candidate==artifacts or candidate in artifacts.parents:ap.error('artifacts outside candidate required')
    artifacts.mkdir(mode=0o700,parents=True)
    broker=str(uuid.uuid4());(artifacts/'resources.jsonl').touch(mode=0o600)
    scratch=pathlib.Path(tempfile.mkdtemp(prefix='rovaq-packages-'));scratch.chmod(0o700)
    receipt={'schema':'rovaq-package-regression-v1','status':'failed','formalAcceptance':False,'commands':[],'scratch':str(scratch),'broker':broker,'limits':['Package mjs suite only; excludes platform TS and apps/web tests','Synthetic local PostgreSQL; no Auth HTTP or provider acceptance']}
    cancelled=[0];old={}
    for sig in (signal.SIGINT,signal.SIGTERM):old[sig]=signal.signal(sig,lambda s,f:cancelled.__setitem__(0,s))
    before=None;control_before=None;docker=None;exit_code=1
    # Reuse the reviewed source fingerprint, without inheriting CI broker variables
    # that would invalidate the chaos CLI's exclusive-journal negative oracle.
    ci=HERE.parents[1]/'tests/acceptance/support/ci';sys.path.insert(0,str(ci))
    import run as ci_run
    control=HERE.parents[1]
    def execute(argv,env,timeout,label):
        started=time.monotonic();record={'argv':argv,'timeoutSeconds':timeout,'log':str(artifacts/(label+'.log'))};receipt['commands'].append(record)
        with open(record['log'],'wb',opener=lambda p,f:os.open(p,f,0o600)) as output:
            p=subprocess.Popen(argv,cwd=scratch,env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
            try:
                while p.poll() is None and not cancelled[0] and time.monotonic()-started<timeout:time.sleep(.05)
                record['timedOut']=p.poll() is None and not cancelled[0]
            finally:
                # Kill the owned process group even after its leader exits.
                if signal_group(p.pid,signal.SIGTERM):
                    time.sleep(.2);signal_group(p.pid,signal.SIGKILL)
                p.wait(timeout=5)
            deadline=time.monotonic()+2
            while not group_absent(p.pid) and time.monotonic()<deadline:time.sleep(.05)
            record['processGroupAbsent']=group_absent(p.pid)
            if not record['processGroupAbsent']:raise ValueError('PROCESS_GROUP_REMAINS')
            record.update(exitCode=p.returncode,seconds=round(time.monotonic()-started,3),sha256=sha(pathlib.Path(record['log'])))
        if record['exitCode'] or record['timedOut'] or cancelled[0]:raise ValueError('COMMAND_FAILED:'+label)
        return pathlib.Path(record['log']).read_text()
    try:
        before=ci_run.fingerprint(candidate);control_before=ci_run.fingerprint(control)
        receipt.update(candidate=str(candidate),candidateSha=git(candidate,'rev-parse','HEAD'),candidateFingerprint=before,controlFingerprint=control_before,controlSha=git(control,'rev-parse','HEAD'))
        if git(candidate,'status','--porcelain'):raise ValueError('CANDIDATE_DIRTY')
        expected=json.loads((HERE/'packages-tests.json').read_text())
        if len(expected['files'])!=55 or inventory(candidate)!=expected['files']:raise ValueError('PACKAGE_TEST_INVENTORY')
        receipt['testFiles']=expected['files']
        archive=artifacts/'source.tar'
        with archive.open('wb') as f:subprocess.run(['git','-C',str(candidate),'archive','--format=tar',receipt['candidateSha']],stdout=f,check=True,timeout=30)
        with tarfile.open(archive) as t:
            members=checked_members(t)
            expected_tree=tree(candidate,receipt['candidateSha'])
            if {m.name for m in members if m.isfile()}!=set(expected_tree):raise ValueError('ARCHIVE_INVENTORY')
            for m in members:
                target=scratch/m.name
                if m.isdir():target.mkdir(parents=True,exist_ok=True)
                else:
                    target.parent.mkdir(parents=True,exist_ok=True)
                    with t.extractfile(m) as source:payload=source.read()
                    mode,blob=expected_tree[m.name]
                    if hashlib.sha1(b'blob '+str(len(payload)).encode()+b'\0'+payload).hexdigest()!=blob or bool(m.mode&0o111)!=(mode=='100755'):raise ValueError('ARCHIVE_BYTES_OR_MODE')
                    target.write_bytes(payload)
                    target.chmod(0o755 if m.mode&0o111 else 0o644)
        archive.unlink()
        if inventory(scratch)!=expected['files']:raise ValueError('COPY_TEST_INVENTORY')
        env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR','LANG','LC_ALL','SYSTEMROOT'] if k in os.environ}
        env.update(CI='1',NEXT_TELEMETRY_DISABLED='1',NPM_CONFIG_USERCONFIG='/dev/null',NPM_CONFIG_GLOBALCONFIG=str(scratch/'empty-global-npmrc'),PYTHONDONTWRITEBYTECODE='1')
        node=shutil.which('node',path=env.get('PATH'));docker=shutil.which('docker',path=env.get('PATH'))
        if not node or not docker:raise ValueError('TOOLS_REQUIRED')
        version=execute([node,'--version'],env,10,'node-version').strip()
        if not re.fullmatch(r'v22\.\d+\.\d+',version):raise ValueError('NODE_22_REQUIRED')
        receipt['nodeVersion']=version
        execute(['npm','ci','--offline','--ignore-scripts','--no-audit','--no-fund'],env,150,'npm-ci')
        binpath=artifacts/'bin';binpath.mkdir();proxy=binpath/'docker';shutil.copyfile(HERE/'packages-docker.py',proxy);proxy.chmod(0o755)
        env.update(PATH=str(binpath)+os.pathsep+env.get('PATH',''),ROVAQ_PACKAGES_ARTIFACTS=str(artifacts),ROVAQ_PACKAGES_BROKER=broker,ROVAQ_PACKAGES_DOCKER=docker)
        output=execute([node,'--experimental-strip-types','--test','--test-concurrency=1','--test-reporter=tap',*expected['files']],env,650,'packages')
        counts={key:re.findall(r'^# '+key+r' (\d+)$',output,re.M) for key in ['tests','pass','fail','cancelled','skipped','todo']}
        if not all(counts.values()) or int(counts['tests'][-1])<55 or counts['pass'][-1]!=counts['tests'][-1] or any(counts[k][-1]!='0' for k in ['fail','cancelled','skipped','todo']):raise ValueError('TAP_INCOMPLETE')
        receipt['testCount']=int(counts['tests'][-1]);receipt['status']='pass';exit_code=0
    except Exception as ex:receipt['error']=type(ex).__name__+': '+str(ex)
    finally:
        groups_absent=all(c.get('processGroupAbsent') for c in receipt['commands'])
        receipt['cleanup']=cleanup(artifacts,broker,docker) if docker and groups_absent else {'verified':False,'reason':'docker unresolved or process group absence unconfirmed'}
        if receipt['status']=='pass' and len(receipt['cleanup'].get('resources',[]))!=4:receipt['status']='resource_coverage_failed';exit_code=1
        if not receipt['cleanup']['verified']:receipt['status']='cleanup_failed';exit_code=1
        try:
            receipt['candidateFingerprintAfter']=ci_run.fingerprint(candidate);receipt['controlFingerprintAfter']=ci_run.fingerprint(control)
            receipt['candidateShaAfter']=git(candidate,'rev-parse','HEAD');receipt['controlShaAfter']=git(control,'rev-parse','HEAD')
            receipt['sourcesUnchanged']=before==receipt['candidateFingerprintAfter'] and control_before==receipt['controlFingerprintAfter'] and receipt.get('candidateSha')==receipt['candidateShaAfter'] and receipt.get('controlSha')==receipt['controlShaAfter']
            if not receipt['sourcesUnchanged']:receipt['status']='integrity_failed';exit_code=1
        except Exception as ex:receipt['status']='integrity_failed';receipt['integrityError']=str(ex);exit_code=1
        try:shutil.rmtree(scratch);receipt['scratchAbsent']=not scratch.exists()
        except Exception as ex:receipt['scratchAbsent']=False;receipt['scratchError']=str(ex);receipt['status']='cleanup_failed';exit_code=1
        if cancelled[0]:receipt['status']='cancelled';exit_code=128+cancelled[0]
        receipt['exitCode']=exit_code;write_json(artifacts/'receipt.json',receipt)
        for sig,handler in old.items():signal.signal(sig,handler)
        print(json.dumps({'receipt':str(artifacts/'receipt.json'),'status':receipt['status'],'exitCode':exit_code}))
    return exit_code
if __name__=='__main__':sys.exit(main())
