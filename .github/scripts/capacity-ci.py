#!/usr/bin/env python3
"""Manual hosted fixed 10K/50K/150K series; no acceptance claim."""
import argparse, base64, datetime, gzip, hashlib, importlib.util, json, math, os, pathlib, re, selectors, signal, stat, subprocess, sys, tempfile, time

CONTROL = pathlib.Path(__file__).resolve().parents[2]
MAX_LOG = 8 * 1024 * 1024
MAX_BUNDLE = 16 * 1024 * 1024
MAX_COMPRESSED = 2 * 1024 * 1024
SCALES = (10000, 50000, 150000)
# Five jobs at 900s plus 900s for setup, upload/API, build and cleanup.
MEASUREMENT_SECONDS = 5400

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
    env.update(CI='1',NEXT_TELEMETRY_DISABLED='1',PYTHONDONTWRITEBYTECODE='1',TMPDIR=str(tmp),VEXA_CANDIDATE=str(candidate),VEXA_LOAD_SCALES='10000,50000,150000',VEXA_LOAD_BASE_PORT='62820',NPM_CONFIG_USERCONFIG='/dev/null',NPM_CONFIG_GLOBALCONFIG=str(tmp/'empty-global-npmrc'))
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

def expected(rows): return {'total':rows,'accepted':rows*98//100,'rejected':rows//100,'duplicates':rows//100,'pending':0}
def finite(value): return type(value) in (int,float) and math.isfinite(value)
def timestamp(value):
    check(isinstance(value,str),'TIMESTAMP_REQUIRED')
    try: parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
    except ValueError: raise ValueError('TIMESTAMP_INVALID') from None
    check(parsed.tzinfo is not None,'TIMESTAMP_TIMEZONE_REQUIRED');return parsed

def counters(value):
    check(isinstance(value,dict) and all(k in value for k in expected(0)),'COUNTERS_MISSING')
    result={}
    for k in expected(0):
        n=value[k]
        if isinstance(n,str):check(bool(re.fullmatch(r'0|[1-9]\d{0,5}',n)),'COUNTER_STRING_INVALID');n=int(n)
        check(type(n) is int and 0<=n<=150000,'COUNTER_RANGE');result[k]=n
    return result

def validate_measurement(report,candidate,manifest_hash,benchmark,external):
    check(report.get('schema')=='vexa-load-result-v1' and report.get('synthetic') is True and report.get('status')=='measured','MEASURED_REPORT_REQUIRED')
    check(report.get('candidate')==str(candidate) and report.get('dependencyManifestSha256')==manifest_hash and report.get('benchmarkImplementation')==benchmark,'REPORT_SOURCE_BINDING')
    check(report.get('priorEvidence') is None,'NO_EXTERNAL_PRIOR_REPORT')
    scales=report.get('scales');check(isinstance(scales,list) and len(scales)==3 and all(isinstance(s,dict) and type(s.get('rows')) is int for s in scales) and [s.get('rows') for s in scales]==list(SCALES),'EXACT_SERIES_REQUIRED')
    processes=report.get('processes');check(isinstance(processes,list) and len(processes)==3,'ONE_PROCESS_PER_SCALE_REQUIRED')
    all_jobs=set();all_imports=set();previous_finish=timestamp(report.get('startedAt'))
    for s,process,rows in zip(scales,processes,SCALES):
        count=expected(rows);parts=1 if rows<=50000 else 3
        check(s.get('status')=='pass' and s.get('observed')==count and s.get('dataset',{}).get('expected')==count,'TERMINAL_COUNTERS')
        check(all(type(v) is int for v in s['observed'].values()) and all(type(v) is int for v in s['dataset']['expected'].values()),'COUNTER_TYPES')
        check(type(s.get('concurrency')) is int and s['concurrency']==1 and type(s.get('workerChunkRows')) is int and s['workerChunkRows']==100 and type(s.get('jobDeadlineMs')) is int and s['jobDeadlineMs']==900000,'LOAD_CONFIGURATION_CHANGED')
        dataset=s['dataset'];seed=308+rows
        check(dataset.get('schema')=='vexa-synthetic-load-v1' and dataset.get('synthetic') is True and dataset.get('rows')==rows and dataset.get('seed')==s.get('seed')==seed and dataset.get('limits')=={'rowsPerFile':50000,'bytesPerFile':20*1024*1024},'DATASET_IDENTITY')
        unsigned={k:v for k,v in dataset.items() if k!='sha256'}
        check(dataset.get('sha256')==digest(json.dumps(unsigned,separators=(',',':'),ensure_ascii=False).encode()),'DATASET_MANIFEST_HASH')
        files=s.get('files');generated=dataset.get('files')
        check(isinstance(files,list) and isinstance(generated,list) and len(files)==len(generated)==parts,'FILE_COVERAGE')
        chunks=s.get('chunks');check(isinstance(chunks,list) and len(chunks)==rows//100,'CHUNK_COVERAGE')
        started=timestamp(s.get('startedAt'));check(started>=previous_finish,'SCALE_ORDER_TIMING')
        check(process.get('chunks')==chunks and timestamp(process.get('startedAt'))>=started and timestamp(process.get('endedAt'))>=timestamp(process['startedAt']),'PROCESS_COVERAGE')
        previous_finish=timestamp(process['endedAt']);offset=0;chunk_index=0
        for part,(f,g) in enumerate(zip(files,generated),1):
            n=min(50000,rows-offset);wanted=expected(n)
            check(isinstance(f,dict) and isinstance(g,dict) and all(f.get(k)==v for k,v in g.items()),'FILE_MANIFEST_BINDING')
            check(set(g)=={'filename','rows','bytes','sha256','firstIndex','lastIndex'} and g['filename']==f'SYN-{rows}-{seed}-part-{part}.csv' and type(g['rows']) is int and g['rows']==n and type(g['firstIndex']) is int and g['firstIndex']==offset and type(g['lastIndex']) is int and g['lastIndex']==offset+n-1,'FILE_PARTITION')
            check(type(g['bytes']) is int and 0<g['bytes']<=20*1024*1024 and isinstance(g['sha256'],str) and re.fullmatch('[0-9a-f]{64}',g['sha256']),'FILE_BYTES_HASH')
            for key,seen in [('jobId',all_jobs),('importId',all_imports)]:
                value=f.get(key);check(isinstance(value,str) and re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}',value) and value not in seen,'UNIQUE_JOB_IMPORT');seen.add(value)
            observed=f.get('observed',{});check(observed.get('fileHash')==g['sha256'] and counters(observed)==counters(f.get('apiCounters'))==wanted,'SQL_API_COUNTERS')
            timing=f.get('jobTiming',{});elapsed=timing.get('elapsedMs')
            check(timing.get('state')=='partial' and type(timing.get('failureCount')) is int and timing['failureCount']==0 and finite(elapsed) and 0<elapsed<900000,'JOB_DEADLINE_OR_FAILURE')
            first=timestamp(timing.get('firstStartedAt'));last=timestamp(timing.get('lastFinishedAt'));deadline=timestamp(timing.get('deadline'))
            check(started<=first<=last<=deadline and math.isclose((last-first).total_seconds()*1000,elapsed,abs_tol=1),'JOB_TIMING')
            for i,ch in enumerate(chunks[chunk_index:chunk_index+n//100],1):
                check(ch.get('kind')=='chunk' and ch.get('jobId')==f['jobId'] and type(ch.get('rows')) is int and ch['rows']==100 and type(ch.get('offset')) is int and ch['offset']==i*100 and ch.get('committed') is True and ch.get('done') is (i==n//100),'CHUNK_ACCOUNTING')
                a=ch.get('monotonicStartMs');b=ch.get('monotonicEndMs');ms=ch.get('commitMs')
                check(all(finite(x) for x in [a,b,ms]) and 0<=a<=b and 0<=ms<900000 and math.isclose(b-a,ms,abs_tol=1e-7),'CHUNK_TIMING')
                check(first<=timestamp(ch.get('startedAt'))<=timestamp(ch.get('finishedAt'))<=deadline,'CHUNK_WALL_TIME')
            offset+=n;chunk_index+=n//100
        check(all(finite(s.get(k)) and 0<s[k] for k in ['processingMs','endToEndMs']) and s['processingMs']<3600000 and s['endToEndMs']>=s['processingMs'],'SCALE_TIMING')
        api=s.get('apiRequests');check(isinstance(api,list) and [a.get('label') for a in api]==['reserve','storage_upload','mapping_preview','confirm']*parts+['job_status']*parts and all(finite(a.get('ms')) and a['ms']>=0 for a in api),'API_TIMING_COVERAGE')
        metrics=s.get('metrics',{});check(metrics.get('commitSamples')==rows//100 and metrics.get('apiSamples')==len(api),'METRIC_COVERAGE')
    cleanup=report.get('cleanup') or {};check(cleanup.get('ownResourcesRemoved') is True and cleanup.get('temporaryPathsRemoved') is True,'INTERNAL_CLEANUP_REQUIRED')
    resources=cleanup.get('resources');check(isinstance(resources,list) and len(resources)==5 and all(r.get('absent') is True for r in resources),'INTERNAL_RESOURCES_REQUIRED')
    other=external.get('resources');check(external.get('verified') is True and isinstance(other,list) and len(other)==5 and all(r.get('absent') is True for r in other),'EXTERNAL_CLEANUP_REQUIRED')
    a={(r['kind'],r['name'],r['broker']) for r in resources};b={(r['kind'],r['name'],r['broker']) for r in other};check(a==b and len(a)==5 and sum(r['kind']=='container' for r in resources)==4 and sum(r['kind']=='network' for r in resources)==1,'CLEANUP_COVERAGE')
    check(timestamp(report.get('finishedAt'))>=previous_finish,'MEASUREMENT_INCOMPLETE')

def transport_bundle(bundle):
    raw=json.dumps(bundle,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode();check(len(raw)<=MAX_BUNDLE,'EVIDENCE_RAW_LIMIT')
    packed=gzip.compress(raw,mtime=0);check(len(packed)<=MAX_COMPRESSED,'EVIDENCE_COMPRESSED_LIMIT')
    encoded=base64.b64encode(packed).decode();meta={'schema':'vexa-capacity-log-v1','encoding':'gzip+base64','rawBytes':len(raw),'rawSha256':digest(raw),'gzipBytes':len(packed),'gzipSha256':digest(packed),'chunks':(len(encoded)+2999)//3000}
    lines=['VEXA_CAPACITY_EVIDENCE_BEGIN '+json.dumps(meta,sort_keys=True)]
    lines.extend('VEXA_CAPACITY_EVIDENCE_CHUNK '+str(i//3000)+' '+encoded[i:i+3000] for i in range(0,len(encoded),3000));lines.append('VEXA_CAPACITY_EVIDENCE_END '+meta['rawSha256']);return lines


# Capacity invokes only launch({services:true}); browser/mail delivery are not exercised.
BOOTSTRAP_IMAGES = (('public.ecr.aws/supabase/postgres:17.6.1.159', '86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f'), ('public.ecr.aws/supabase/gotrue:v2.195.0', '362659ca70eaa75ba05bbaf963caa84c1c5afe5e8fbf0777e17b830dd5f0f60a'), ('public.ecr.aws/supabase/storage-api:v1.69.11', '97ed68d33417d253a45fe0a70f84324d92250a3e239bf18aa6cf87269dbf6727'), ('public.ecr.aws/supabase/postgrest:v16.1', '5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d'))

def bootstrap_dependencies(candidate, authorized):
    check(authorized and os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted' and os.environ.get('GITHUB_REF')=='refs/heads/main','BOOTSTRAP_HOSTED_MAIN_AUTH_REQUIRED')
    # Reuse the existing trusted environment contract, not a wider shell environment.
    support=CONTROL/'tests/acceptance/support/ci'
    sys.path.insert(0,str(support))
    try:
        spec=importlib.util.spec_from_file_location('capacity_bootstrap_environment',support/'run.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        environment=module.environment
    finally:sys.path.pop(0)
    import shutil
    for source,dirs in [(candidate,('package.json','package-lock.json','apps','packages')),(CONTROL/'tests/acceptance/support/F01-02',('package.json','package-lock.json'))]:
        with tempfile.TemporaryDirectory(prefix='vexa-ci-bootstrap-') as temp:
            dest=pathlib.Path(temp)
            for rel in dirs:
                src=source/rel
                if src.is_dir():shutil.copytree(src,dest/rel,ignore=shutil.ignore_patterns('.git','.next','node_modules','.env*'))
                else:shutil.copy2(src,dest/rel)
            subprocess.run(['npm','ci','--ignore-scripts','--no-audit','--no-fund'],cwd=dest,env=environment(dest,candidate),check=True)
    for image,pinned in BOOTSTRAP_IMAGES:
        ref=image.split(':')[0]+'@sha256:'+pinned
        subprocess.run(['docker','pull','--platform','linux/arm64',ref],check=True)
        subprocess.run(['docker','tag',ref,image],check=True)

def main():
    p=argparse.ArgumentParser();p.add_argument('--candidate',type=pathlib.Path,required=True);p.add_argument('--event-sha',required=True);p.add_argument('--bootstrap-outcome',choices=['success','failure','cancelled','skipped'],default='skipped');mode=p.add_mutually_exclusive_group();mode.add_argument('--identity-only',action='store_true');mode.add_argument('--bootstrap-only',action='store_true');p.add_argument('--authorized-disposable-runner',action='store_true');args=p.parse_args()
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
    check(not args.authorized_disposable_runner or args.bootstrap_only,'BOOTSTRAP_FLAG_SCOPE')
    if args.bootstrap_only:
        bootstrap_dependencies(candidate,args.authorized_disposable_runner);return 0
    if args.identity_only:
        print('VEXA_CAPACITY_IDENTITY_VERIFIED '+json.dumps({'eventSha':args.event_sha,'correlation':correlation}));return 0
    artifact=pathlib.Path(tempfile.mkdtemp(prefix='vexa-capacity-ci-',dir=runner));artifact.chmod(0o700);tmp=artifact/'tmp';tmp.mkdir(mode=0o700)
    spec=importlib.util.spec_from_file_location('capacity_lifecycle',CONTROL/'tests/acceptance/support/ci/lifecycle.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);life=module.Lifecycle(artifact);life.install()
    env=clean_env(candidate,tmp);commands=[];evidence=None;external={'verified':False};report=None
    receipt={'schema':'capacity-manual-series-v1','status':'FAILED','synthetic':True,'eventSha':args.event_sha,'correlation':correlation,'repository':os.environ.get('GITHUB_REPOSITORY'),'runId':os.environ.get('GITHUB_RUN_ID'),'runAttempt':os.environ.get('GITHUB_RUN_ATTEMPT'),'candidate':str(candidate),'control':str(CONTROL),'bootstrapOutcome':args.bootstrap_outcome,'commands':commands,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'notProved':['commercial capacity or SLO','AI/inference/training','production acceptance'],'fixedScales':list(SCALES),'jobDeadlineMs':900000,'measurementTimeoutSeconds':MEASUREMENT_SECONDS}
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
        for stage,argv,timeout in [('preflight',['node',str(load),'--preflight'],60),('measurement',['node',str(load)],MEASUREMENT_SECONDS),('source-postflight',['node',str(load),'--preflight'],60)]:
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
        receipt['status']='MEASURED_10K_50K_150K_COUNTS_AND_CLEANUP_VERIFIED';code=0
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
