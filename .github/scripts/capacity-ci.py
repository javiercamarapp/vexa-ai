#!/usr/bin/env python3
"""Manual hosted 10K measurement; no escalation or acceptance claim."""
import argparse, base64, gzip, hashlib, importlib.util, json, os, pathlib, re, selectors, signal, stat, subprocess, sys, tempfile, time

CONTROL = pathlib.Path(__file__).resolve().parents[2]
MAX_LOG = 8 * 1024 * 1024
MAX_BUNDLE = 16 * 1024 * 1024
MAX_COMPRESSED = 2 * 1024 * 1024
EXPECTED = {'total': 10000, 'accepted': 9800, 'rejected': 100, 'duplicates': 100, 'pending': 0}

def check(ok, code):
    if not ok: raise ValueError(code)
def digest(data): return hashlib.sha256(data).hexdigest()
def read_json(p): return json.loads(pathlib.Path(p).read_bytes())
def regular(p, limit=MAX_LOG):
    p=pathlib.Path(p)
    check(p.is_absolute(), 'ABSOLUTE_PATH_REQUIRED')
    for parent in [*reversed(p.parents),p]: check(not parent.is_symlink(), 'SYMLINK_FORBIDDEN')
    s=p.stat();check(stat.S_ISREG(s.st_mode) and s.st_uid==os.getuid() and s.st_nlink==1 and s.st_size<=limit,'UNSAFE_EVIDENCE_FILE')
    return p.read_bytes()
def sanitize(text):
    for pattern in [r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',r'github_pat_[A-Za-z0-9_]+',r'gh[pousr]_[A-Za-z0-9]+']:
        text=re.sub(pattern,'[TOKEN_REDACTED]',text)
    return text

def clean_env(candidate, tmp):
    env={k:os.environ[k] for k in ('PATH','HOME','LANG','LC_ALL') if k in os.environ}
    env.update(CI='1',NEXT_TELEMETRY_DISABLED='1',PYTHONDONTWRITEBYTECODE='1',TMPDIR=str(tmp),VEXA_CANDIDATE=str(candidate),VEXA_LOAD_SCALES='10000',VEXA_LOAD_BASE_PORT='62820',NPM_CONFIG_USERCONFIG='/dev/null',NPM_CONFIG_GLOBALCONFIG=str(tmp/'empty-global-npmrc'))
    return env

def bound_evidence(output,tmp):
    matches=re.findall(r'^LOAD308_RUNNING:([^\r\n]+)$',output,re.M)
    check(len(matches)==1,'ONE_EVIDENCE_PATH_REQUIRED')
    p=pathlib.Path(matches[0]);check(p.parent==tmp and re.fullmatch(r'vexa-load308-[A-Za-z0-9_-]+',p.name),'EVIDENCE_PATH_SCOPE')
    check(p.resolve()==p and p.is_dir() and p.stat().st_uid==os.getuid() and stat.S_IMODE(p.stat().st_mode)==0o700,'EVIDENCE_DIRECTORY_UNSAFE')
    return p

def run_process(argv,cwd,env,log,life,timeout):
    started=time.monotonic();child=None;chunks=[];size=0;code=1;reason=None;process_clean=False
    try:
        child=subprocess.Popen(argv,cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
        sel=selectors.DefaultSelector();sel.register(child.stdout,selectors.EVENT_READ)
        while sel.get_map():
            if life.cancelled: reason='CANCELLED';break
            if time.monotonic()-started>=timeout: reason='TIMEOUT';break
            for key,_ in sel.select(.1):
                b=os.read(key.fileobj.fileno(),65536)
                if not b:sel.unregister(key.fileobj);continue
                size+=len(b)
                if size>MAX_LOG:reason='OUTPUT_LIMIT';break
                chunks.append(b)
            if reason:break
        sel.close()
        if reason is None:code=child.wait(timeout=5)
    finally:
        if child is not None:
            try:
                tail=life.stop(child);process_clean=True
                if tail:
                    tail=tail.encode() if isinstance(tail,str) else tail
                    if size+len(tail)>MAX_LOG:reason='OUTPUT_LIMIT'
                    else:chunks.append(tail)
            except Exception:reason='PROCESS_CLEANUP_FAILED'
        raw=b''.join(chunks);pathlib.Path(log).write_text(sanitize(raw.decode('utf8','replace')));os.chmod(log,0o600)
    return {'argv':list(map(str,argv)),'cwd':str(cwd),'exit_code':code if reason is None else 1,'reason':reason,'seconds':round(time.monotonic()-started,3),'process_group_stopped':process_clean,'log':pathlib.Path(log).name},raw.decode('utf8','replace')

def inspect_owned(evidence, env):
    journal=evidence/'resources.jsonl';raw=regular(journal);check(stat.S_IMODE(journal.stat().st_mode)==0o600,'JOURNAL_MODE')
    entries=[json.loads(line) for line in raw.splitlines() if line]
    check(entries,'OWNED_JOURNAL_EMPTY')
    brokers={e.get('broker') for e in entries};check(len(brokers)==1,'BROKER_AMBIGUOUS');broker=next(iter(brokers));check(isinstance(broker,str) and re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}',broker),'BROKER_INVALID')
    for e in entries:check(set(e)=={'kind','name','broker'} and e['kind'] in ('container','network') and re.fullmatch(r'vexa-f01-0[234]-[0-9a-f-]{36}(?:-[a-z]+)?',e['name']),'JOURNAL_INVALID')
    unique={(e['kind'],e['name']):e for e in entries};results=[]
    for e in unique.values():
        labels='.Labels' if e['kind']=='network' else '.Config.Labels'
        r=subprocess.run(['docker',e['kind'],'inspect',e['name'],'--format','{{.Id}}|{{.Name}}|{{ index '+labels+' "vexa.ci.broker" }}'],capture_output=True,text=True,env=env,timeout=15)
        absent=r.returncode!=0 and bool(re.search(r'No such (object|container|network)',r.stderr,re.I) or r.stderr.strip()=='Error response from daemon: network '+e['name']+' not found')
        item={**e,'absent':absent}
        if r.returncode==0:
            parts=r.stdout.strip().split('|');check(len(parts)==3 and re.fullmatch('[a-f0-9]{64}',parts[0]) and parts[1].lstrip('/')==e['name'] and parts[2]==broker,'RESOURCE_OWNERSHIP_MISMATCH');item['id']=parts[0]
        elif not absent:item['inspectionError']='DOCKER_INSPECT_FAILED'
        results.append(item)
    return {'verified':bool(results) and all(x['absent'] for x in results),'broker':broker,'resources':results,'mode':'inspect-only-no-removal'}

def counters(value):
    check(isinstance(value,dict) and all(k in value for k in EXPECTED),'COUNTERS_MISSING')
    result={}
    for k in EXPECTED:
        n=value[k]
        if isinstance(n,str):check(bool(re.fullmatch(r'0|[1-9]\d{0,4}',n)),'COUNTER_STRING_INVALID');n=int(n)
        check(type(n) is int and 0<=n<=10000,'COUNTER_RANGE');result[k]=n
    return result

def validate_measurement(report,candidate,manifest_hash,benchmark,external):
    check(report.get('schema')=='vexa-load-result-v1' and report.get('synthetic') is True and report.get('status')=='measured','MEASURED_REPORT_REQUIRED')
    check(report.get('candidate')==str(candidate) and report.get('dependencyManifestSha256')==manifest_hash and report.get('benchmarkImplementation')==benchmark,'REPORT_SOURCE_BINDING')
    scales=report.get('scales');check(isinstance(scales,list) and len(scales)==1 and scales[0].get('rows')==10000 and scales[0].get('status')=='pass','EXACT_10K_REQUIRED')
    s=scales[0];check(s.get('observed')==EXPECTED and s.get('dataset',{}).get('expected')==EXPECTED,'TERMINAL_COUNTERS')
    check(all(type(v) is int for v in s.get('observed',{}).values()),'COUNTER_TYPES')
    check(s.get('concurrency')==1 and s.get('workerChunkRows')==100,'LOAD_CONFIGURATION_CHANGED')
    check(isinstance(s.get('files'),list) and s['files'] and sum(f.get('rows',0) for f in s['files'])==10000,'FILE_COVERAGE')
    for f in s['files']:
        observed=f.get('observed',{});check(observed.get('fileHash')==f.get('sha256') and counters(observed)==counters(f.get('apiCounters')),'SQL_API_COUNTERS')
    cleanup=report.get('cleanup') or {};check(cleanup.get('ownResourcesRemoved') is True and cleanup.get('temporaryPathsRemoved') is True,'INTERNAL_CLEANUP_REQUIRED')
    resources=cleanup.get('resources');check(isinstance(resources,list) and resources and all(r.get('absent') is True for r in resources),'INTERNAL_RESOURCES_REQUIRED')
    check(external.get('verified') is True and external.get('resources'),'EXTERNAL_CLEANUP_REQUIRED')
    a={(r['kind'],r['name'],r['broker']) for r in resources};b={(r['kind'],r['name'],r['broker']) for r in external['resources']};check(a==b and len(a)==5 and sum(r['kind']=='container' for r in resources)==4,'CLEANUP_COVERAGE')
    check(report.get('finishedAt') and report.get('startedAt') and report.get('processes'),'MEASUREMENT_INCOMPLETE')

def transport_bundle(bundle):
    raw=json.dumps(bundle,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode();check(len(raw)<=MAX_BUNDLE,'EVIDENCE_RAW_LIMIT')
    packed=gzip.compress(raw,mtime=0);check(len(packed)<=MAX_COMPRESSED,'EVIDENCE_COMPRESSED_LIMIT')
    encoded=base64.b64encode(packed).decode();meta={'schema':'vexa-capacity-log-v1','encoding':'gzip+base64','rawBytes':len(raw),'rawSha256':digest(raw),'gzipBytes':len(packed),'gzipSha256':digest(packed),'chunks':(len(encoded)+2999)//3000}
    lines=['VEXA_CAPACITY_EVIDENCE_BEGIN '+json.dumps(meta,sort_keys=True)]
    lines.extend('VEXA_CAPACITY_EVIDENCE_CHUNK '+str(i//3000)+' '+encoded[i:i+3000] for i in range(0,len(encoded),3000));lines.append('VEXA_CAPACITY_EVIDENCE_END '+meta['rawSha256']);return lines

def main():
    p=argparse.ArgumentParser();p.add_argument('--candidate',type=pathlib.Path,required=True);p.add_argument('--event-sha',required=True);p.add_argument('--bootstrap-outcome',choices=['success','failure','cancelled','skipped'],default='skipped');p.add_argument('--identity-only',action='store_true');args=p.parse_args()
    correlation=os.environ.get('CAPACITY_CORRELATION','');check(re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}',correlation),'CORRELATION_UUID_REQUIRED')
    candidate=args.candidate.resolve();workspace=pathlib.Path(os.environ.get('GITHUB_WORKSPACE','/nonexistent')).resolve();runner=pathlib.Path(os.environ.get('RUNNER_TEMP','/nonexistent')).resolve()
    check(os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted' and os.environ.get('RUNNER_OS')=='Linux' and os.environ.get('RUNNER_ARCH')=='ARM64','HOSTED_LINUX_ARM_REQUIRED')
    check(os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch' and os.environ.get('GITHUB_REF')=='refs/heads/main','MANUAL_MAIN_REQUIRED')
    check(os.environ.get('GITHUB_RUN_ATTEMPT')=='1','RERUN_REQUIRES_NEW_REVIEWED_DISPATCH')
    check(re.fullmatch('[0-9a-f]{40}',args.event_sha) and os.environ.get('GITHUB_SHA')==args.event_sha,'EVENT_SHA_INVALID')
    check(CONTROL==workspace/'control' and candidate==workspace/'candidate' and CONTROL!=candidate and runner.is_dir(),'CHECKOUT_PATHS')
    identity_env={k:os.environ[k] for k in ('PATH','HOME') if k in os.environ}
    for checkout in (CONTROL,candidate):
        check(subprocess.check_output(['git','rev-parse','HEAD'],cwd=checkout,env=identity_env,text=True).strip()==args.event_sha,'CHECKOUT_SHA_MISMATCH')
        check(not subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=checkout,env=identity_env,text=True).strip(),'CHECKOUT_DIRTY')
    if args.identity_only:
        print('VEXA_CAPACITY_IDENTITY_VERIFIED '+json.dumps({'eventSha':args.event_sha,'correlation':correlation}));return 0
    artifact=pathlib.Path(tempfile.mkdtemp(prefix='vexa-capacity-ci-',dir=runner));artifact.chmod(0o700);tmp=artifact/'tmp';tmp.mkdir(mode=0o700)
    spec=importlib.util.spec_from_file_location('capacity_lifecycle',CONTROL/'tests/acceptance/support/ci/lifecycle.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);life=module.Lifecycle(artifact);life.install()
    env=clean_env(candidate,tmp);commands=[];evidence=None;external={'verified':False};report=None
    receipt={'schema':'capacity-manual-10k-v1','status':'FAILED','synthetic':True,'eventSha':args.event_sha,'correlation':correlation,'repository':os.environ.get('GITHUB_REPOSITORY'),'runId':os.environ.get('GITHUB_RUN_ID'),'runAttempt':os.environ.get('GITHUB_RUN_ATTEMPT'),'candidate':str(candidate),'control':str(CONTROL),'bootstrapOutcome':args.bootstrap_outcome,'commands':commands,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'notProved':['50K/150K','commercial capacity or SLO','AI/inference/training','production acceptance'],'escalationAuthorized':False}
    logs={};code=1
    try:
        for checkout in (CONTROL,candidate):
            check(subprocess.check_output(['git','rev-parse','HEAD'],cwd=checkout,env=env,text=True).strip()==args.event_sha,'CHECKOUT_SHA_MISMATCH')
            check(not subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=checkout,env=env,text=True).strip(),'CHECKOUT_DIRTY')
        check(subprocess.check_output(['node','--version'],env=env,text=True).startswith('v22.'),'NODE22_REQUIRED')
        receipt['diskBefore']=dict(zip(('total','used','free'),__import__('shutil').disk_usage(runner)))
        check(args.bootstrap_outcome=='success','BOOTSTRAP_NOT_SUCCESSFUL')
        check(receipt['diskBefore']['free']>=3*1024**3,'RUNNER_DISK_BELOW_3GIB')
        load=candidate/'packages/jobs/load/run.mjs';manifest=candidate/'packages/jobs/load/dependencies.json';manifest_hash=digest(manifest.read_bytes());benchmark={n:digest((load.parent/n).read_bytes()) for n in ['generator.mjs','harness.mjs','run.mjs','worker.mjs','dependencies.json']};receipt['dependencyManifestSha256']=manifest_hash;receipt['benchmarkImplementation']=benchmark
        for stage,argv,timeout in [('preflight',['node',str(load),'--preflight'],60),('measurement',['node',str(load)],1320),('source-postflight',['node',str(load),'--preflight'],60)]:
            command,out=run_process(argv,CONTROL,env,artifact/(stage+'.log'),life,timeout);commands.append(command)
            if stage=='measurement':
                try:evidence=bound_evidence(out,tmp)
                except ValueError:
                    if command['exit_code']==0:raise
            check(command['exit_code']==0 and command['process_group_stopped'],stage.upper()+'_FAILED')
            if stage!='measurement':
                parsed=json.loads(out);check(parsed.get('status')=='source-preflight-only' and parsed.get('dependencyManifestSha256')==manifest_hash and parsed.get('capacityMeasured') is False,'SOURCE_PREFLIGHT_INVALID')
        check(evidence is not None,'MEASUREMENT_EVIDENCE_MISSING');report=read_json(evidence/'report.json');external=inspect_owned(evidence,env);validate_measurement(report,candidate,manifest_hash,benchmark,external)
        for checkout in (CONTROL,candidate):check(not subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=checkout,env=env,text=True).strip(),'CHECKOUT_CHANGED')
        receipt['status']='MEASURED_10K_COUNTS_AND_CLEANUP_VERIFIED';code=0
    except Exception as e:receipt['error']=str(e) if isinstance(e,ValueError) else type(e).__name__
    finally:
        try:
            if evidence:
                try:external=inspect_owned(evidence,env)
                except Exception as e:external={'verified':False,'error':type(e).__name__}
                for f in sorted(evidence.iterdir()):
                    if f.is_file() or f.is_symlink():
                        raw=regular(f);text=sanitize(raw.decode('utf8','replace'));logs['benchmark/'+f.name]={'originalSha256':digest(raw),'redacted':text.encode()!=raw,'text':text}
            for f in artifact.glob('*.log'):
                raw=regular(f);logs['wrapper/'+f.name]={'originalSha256':digest(raw),'redacted':False,'text':raw.decode()}
            bootstrap=runner/'vexa-capacity-bootstrap.log'
            if bootstrap.exists():
                raw=regular(bootstrap);text=sanitize(raw.decode('utf8','replace'));logs['bootstrap.log']={'originalSha256':digest(raw),'redacted':text.encode()!=raw,'text':text}
            receipt['cleanup']=external
            if life.cancelled:receipt['status']='CANCELLED';code=1
            if receipt['status'].startswith('MEASURED') and not external['verified']:receipt['status']='CLEANUP_FAILED';code=1
            receipt['exitCode']=code;receipt['finishedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
            for line in transport_bundle({'receipt':receipt,'files':logs}):print(line,flush=True)
        except Exception as e:
            code=1;print('VEXA_CAPACITY_EVIDENCE_UNAVAILABLE '+json.dumps({'status':'FAILED','reason':str(e) if isinstance(e,ValueError) else type(e).__name__}),flush=True)
        finally:life.restore()
    return code

if __name__=='__main__':
    try:sys.exit(main())
    except Exception as e:
        print('VEXA_CAPACITY_LAUNCH_REJECTED '+json.dumps({'status':'FAILED','reason':str(e) if isinstance(e,ValueError) else type(e).__name__}));sys.exit(1)
