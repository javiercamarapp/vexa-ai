#!/usr/bin/env python3
"""Manual hosted ABBA persistence comparison; no adoption or capacity claim."""
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

def validate_sql_profile(profile, queries):
    import math
    keys={'schema','complete','started','completed','failed','pending','overflow','unclassified','invalidDurations','groups'}
    check(isinstance(profile,dict) and set(profile)==keys and profile['schema']=='vexa-synthetic-sql-profile-v1' and profile['complete'] is True,'SQL_PROFILE_REQUIRED')
    check(type(queries) is int and queries>0,'SQL_QUERY_COUNT_REQUIRED')
    for k in ['started','completed','failed','pending','overflow','unclassified','invalidDurations']:
        check(type(profile[k]) is int and profile[k]>=0,'SQL_PROFILE_COUNTER_TYPE')
    check(profile['started']==profile['completed']==queries and all(profile[k]==0 for k in ['pending','overflow','unclassified','invalidDurations']),'SQL_PROFILE_COMPLETENESS')
    groups=profile['groups'];check(isinstance(groups,list) and 0<len(groups)<=128,'SQL_PROFILE_GROUP_BOUND')
    hashes=set();count=failed=0
    for g in groups:
        check(isinstance(g,dict) and set(g)=={'querySha256','count','failed','totalMs','minMs','maxMs'},'SQL_PROFILE_FIELDS')
        h=g['querySha256'];check(isinstance(h,str) and re.fullmatch('[a-f0-9]{64}',h) and h not in hashes,'SQL_PROFILE_QUERY_HASH');hashes.add(h)
        check(type(g['count']) is int and g['count']>0 and type(g['failed']) is int and 0<=g['failed']<=g['count'],'SQL_PROFILE_GROUP_COUNT')
        check(all(type(g[k]) in (int,float) and math.isfinite(g[k]) and g[k]>=0 for k in ['totalMs','minMs','maxMs']),'SQL_PROFILE_DURATION')
        tolerance=1e-8*max(1,g['totalMs'])
        check(g['minMs']<=g['maxMs'] and g['maxMs']<=g['totalMs']+tolerance and g['count']*g['minMs']<=g['totalMs']+tolerance and g['totalMs']<=g['count']*g['maxMs']+tolerance,'SQL_PROFILE_DURATION_BOUNDS')
        count+=g['count'];failed+=g['failed']
    check(count==queries and failed==profile['failed'],'SQL_PROFILE_TOTALS')

def validate_measurement(report,candidate,manifest_hash,benchmark,external):
    check(report.get('schema')=='vexa-persistence-comparison-v1' and report.get('synthetic') is True and report.get('status')=='comparison_completed','COMPARISON_REPORT_REQUIRED')
    check(report.get('acceptance') is False and report.get('production') is False,'NO_ACCEPTANCE_CLAIM')
    check(report.get('candidate')==str(candidate) and report.get('dependencyManifestSha256')==manifest_hash and report.get('benchmarkImplementation')==benchmark,'REPORT_SOURCE_BINDING')
    scripts=['capacity-compare.mjs','capacity-host.mjs','capacity-variant.json','capacity-query-profile.mjs']
    check(report.get('comparisonImplementation')=={n:digest((CONTROL/'.github/scripts'/n).read_bytes()) for n in scripts},'COMPARISON_SOURCE_BINDING')
    check(report.get('comparisonBuildInputs')=={'packages/intelligence/source-reader.mjs':digest((candidate/'packages/intelligence/source-reader.mjs').read_bytes())},'COMPARISON_BUILD_INPUTS')
    variant=read_json(CONTROL/'.github/scripts/capacity-variant.json')
    check(report.get('persistenceHashes')=={'baseline':variant['baselineSha256'],'batched':variant['proposalSha256']},'VARIANT_BINDING')
    builds=report.get('buildComparison',{});check(builds.get('changed')==['packages/ingestion/persistence/index.mjs'] and type(builds.get('files')) is int and builds['files']>0,'BUILD_DELTA')
    check(all(isinstance(builds.get(k),str) and re.fullmatch('[a-f0-9]{64}',builds[k]) for k in ['baseline','batched']) and builds['baseline']!=builds['batched'],'BUILD_HASHES')
    names=['worker_revocation_preserves_block','accounting_failure_rolls_back_row_and_counter','historical_midchunk_rollback_then_same_block','historical_readback_replay_and_other_tenant','new_revision_and_tombstone_no_resurrection','guarded_revision_read_and_late_revocation']
    semantics=report.get('semantics',[]);check([x.get('name') for x in semantics]==[mode+':'+name for mode in ['baseline','batched'] for name in names] and all(x.get('status')=='pass' for x in semantics),'SEMANTIC_CONTROLS')
    for i in [0,6]:
        check(semantics[i].get('denied') is True,'REVOCATION_REQUIRED')
        x=semantics[i+1];check(x.get('counterWriteReached') is True and x.get('rolledBackTables')==9 and x.get('rowAndCounterUnchanged') is True and x.get('checkpointUnchanged') is True,'ACCOUNTING_ROLLBACK_REQUIRED')
        x=semantics[i+2];check(x.get('firstRowAppliedBeforeFailure') is True and x.get('rolledBackTables')==9 and x.get('recoveredRows')==2,'ROLLBACK_REQUIRED')
        x=semantics[i+3];check(x.get('textLength')==100000 and x.get('rows')==2 and x.get('replayUnchanged') is True and x.get('otherTenantDenied') is True and len(x.get('persistedSourceReaderHashes',[]))==2,'HISTORICAL_READBACK_REQUIRED')
        x=semantics[i+4];check(x.get('originalMicrosecondsDistinct') is True and x.get('revisionsRetained') is True and x.get('tombstoneRejected')==1 and x.get('newRevisionAfterTombstoneDenied') is True,'TOMBSTONE_REVISION_REQUIRED')
        x=semantics[i+5]
        required=['tombstoneSkippedLookup','lookupErrorReached','lookupFailureRolledBack','lookupRecoveredDuplicate','lateRevocationReached','lateRevocationRolledBack','revocationRecoveredDuplicate','probeObjectsRemoved']
        check(all(x.get(k) is True for k in required) and type(x.get('rolledBackTables')) is int and x['rolledBackTables']==9 and x.get('lateRevocationDeniedStatus')==403,'GUARDED_REVISION_READ_REQUIRED')
    warmups=report.get('warmups',[]);windows=report.get('windows',[])
    check([w.get('mode') for w in warmups]==['baseline','batched'] and [w.get('mode') for w in windows]==['baseline','batched','batched','baseline'],'ABBA_ORDER')
    check([w.get('index') for w in windows]==[0,1,2,3] and [w.get('index') for w in warmups]==[0,1],'WINDOW_INDICES')
    for group,is_warmup,rows in [(warmups,True,100),(windows,False,10000)]:
        for w in group:
            check(w.get('warmup') is is_warmup and w.get('rows')==rows and w.get('status')=='completed','WINDOW_COMPLETION')
            expected={'total':rows,'accepted':rows*98//100,'rejected':rows//100,'duplicates':rows//100,'pending':0}
            check(w.get('observed')==expected and w.get('apiCounters')==expected and all(type(v) is int for data in [w['observed'],w['apiCounters']] for v in data.values()),'WINDOW_COUNTERS')
            check(w.get('canonicalRows')==expected['accepted'],'CANONICAL_RELATIONSHIPS')
            check(w.get('concurrency')==1 and w.get('workerChunkRows')==100 and w.get('deadlineMs')==900000,'LOAD_CONFIGURATION_CHANGED')
            check(type(w.get('processingMs')) in (int,float) and 0<w['processingMs']<900000,'WINDOW_TIME')
            chunks=w.get('chunks',[]);check([c.get('offset') for c in chunks]==list(range(100,rows+1,100)),'CHUNK_OFFSETS')
            query_count=2195 if w['mode']=='baseline' else 1605
            check(all(c.get('committed') is True and c.get('rows')==100 and c.get('queries')==query_count and c.get('done') is (i==len(chunks)-1) for i,c in enumerate(chunks)),'CHUNK_CONSISTENCY')
            check(w.get('chunkSqlQueries')==query_count*len(chunks),'QUERY_COUNT')
            validate_sql_profile(w.get('sqlProfile'),w.get('sqlQueries'))
            check(w['sqlQueries']>=w['chunkSqlQueries'],'SQL_PROFILE_CHUNK_COVERAGE')
            terminal=w.get('terminal',{});check(terminal.get('checkpoint',{}).get('offset')==rows and terminal.get('checkpoint',{}).get('done') is True and terminal.get('job',{}).get('state')=='partial' and terminal.get('job',{}).get('failure_count')==0,'TERMINAL_CHECKPOINT')
    comparison=report.get('comparison',{});samples=report.get('hostSamples',[])
    def host_ready(s):
        keys=['idlePercent','stealPercent','availableMiB','swapoutsDelta']
        return all(type(s.get(k)) in (int,float) and __import__('math').isfinite(s[k]) and s[k]>=0 for k in keys) and 50<=s['idlePercent']<=100 and s['stealPercent']<=5 and s['availableMiB']>=2048 and s['swapoutsDelta']==0
    complete=all(any(s.get('window')==w['index'] and s.get('phase')==phase and s.get('warmup') is False for s in samples) for w in windows for phase in ['before','during','after'])
    stable=complete and all(s.get('phase') in ['before','during','after'] and host_ready(s) for s in samples if s.get('warmup') is False and s.get('window') in [0,1,2,3])
    a=[w['processingMs'] for w in windows if w['mode']=='baseline'];b=[w['processingMs'] for w in windows if w['mode']=='batched'];faster=max(b)<min(a)
    check(comparison=={'baselineMs':a,'batchedMs':b,'meanBaselineMs':sum(a)/2,'meanBatchedMs':sum(b)/2,'allBatchedFaster':faster,'hostSamplesReady':stable,'stableGainSupported':stable and faster,'capacityApproved':False},'INDEPENDENT_COMPARISON')
    check(report.get('deadlineQueryPerTransaction')==1 and report.get('comparison',{}).get('capacityApproved') is False,'COMPARISON_SCOPE')
    cleanup=report.get('cleanup') or {};check(cleanup.get('ownResourcesRemoved') is True and cleanup.get('temporaryPathsRemoved') is True and report.get('cleanupErrors')==[],'INTERNAL_CLEANUP_REQUIRED')
    resources=cleanup.get('resources');check(isinstance(resources,list) and resources and all(r.get('absent') is True for r in resources),'INTERNAL_RESOURCES_REQUIRED')
    check(external.get('verified') is True and external.get('resources'),'EXTERNAL_CLEANUP_REQUIRED')
    a={(r['kind'],r['name'],r['broker']) for r in resources};b={(r['kind'],r['name'],r['broker']) for r in external['resources']};check(a==b and len(a)==5 and sum(r['kind']=='container' for r in resources)==4,'CLEANUP_COVERAGE')
    check(report.get('finishedAt') and report.get('startedAt'),'MEASUREMENT_INCOMPLETE')

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
    receipt={'schema':'capacity-persistence-comparison-v1','status':'FAILED','synthetic':True,'eventSha':args.event_sha,'correlation':correlation,'repository':os.environ.get('GITHUB_REPOSITORY'),'runId':os.environ.get('GITHUB_RUN_ID'),'runAttempt':os.environ.get('GITHUB_RUN_ATTEMPT'),'candidate':str(candidate),'control':str(CONTROL),'bootstrapOutcome':args.bootstrap_outcome,'commands':commands,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'notProved':['optimization adoption','10K/50K/150K','commercial capacity or SLO','AI/inference/training','production acceptance'],'escalationAuthorized':False}
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
        for stage,argv,timeout in [('preflight',['node',str(load),'--preflight'],60),('measurement',['node',str(CONTROL/'.github/scripts/capacity-compare.mjs')],1320),('source-postflight',['node',str(load),'--preflight'],60)]:
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
        receipt['status']='MEASURED_COMPARISON_AND_CLEANUP_VERIFIED';code=0
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
