#!/usr/bin/env python3
"""Bounded diagnostic10K runner. Reuses accepted lifecycle and exact load validation."""
import argparse, hashlib, importlib.util, inspect, json, math, os, pathlib, re, sys, tempfile, time, subprocess
CONTROL=pathlib.Path(__file__).resolve().parents[2]
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
base=load('capacity_server_base',CONTROL/'.github/scripts/capacity-ci.py')
check=base.check;digest=base.digest;read_json=base.read_json;regular=base.regular;sanitize=base.sanitize
run_process=base.run_process;bound_evidence=base.bound_evidence;inspect_owned=base.inspect_owned
bootstrap_dependencies=base.bootstrap_dependencies;transport_bundle=base.transport_bundle
SCALES=(10000,);MEASUREMENT_SECONDS=1800
# Fail closed if the reviewed canonical validator changes. Adapt only cardinality;
# all row/deadline/source/partition/process/cleanup assertions remain byte-identical.
BASE_CI_SHA='3ee49c6dbd7c31d573af0183d222bceb7d8fade81ba551608050bafbd73e7ab3'
check(digest((CONTROL/'.github/scripts/capacity-ci.py').read_bytes())==BASE_CI_SHA,'PROFILE_BASE_VALIDATOR_DRIFT')
code=inspect.getsource(base.validate_measurement)
for old,new in [('len(scales)==3','len(scales)==1'),('len(processes)==3','len(processes)==1')]:
    check(code.count(old)==1,'PROFILE_VALIDATOR_ADAPTER_DRIFT');code=code.replace(old,new)
namespace={**vars(base),'SCALES':SCALES};exec(compile(code,'<reviewed-one-scale-validator>','exec'),namespace)
validate_load=namespace['validate_measurement']
comparison=load('capacity_server_client_validator',CONTROL/'.github/scripts/capacity-compare-ci.py')
def clean_env(candidate,tmp):
    env=base.clean_env(candidate,tmp);env['VEXA_LOAD_SCALES']='10000';return env
EXPECTED_CALLS={'0ad6988e32506f94bbb63ff1a14ee9272a68ac5ef5f190c5611580c3258a8c6f': 9800, '6bde39e2fb3e462b689edd319387d89f9967dca9ff240c90d0eefa84bae9a24f': 9800, 'ae54cf7566ab9692183a0b1719ac039db24ad08006e3d51a8606ee764988591c': 9800, '3e13039c6ef5fa65f9a8cc8c056e13815b6f472c78a1f5b46b4077b207664371': 9800, '34368b5907a00988f5b79e61048cfa66da1332cc1efdf5a9163af93af2477677': 9800, '6d9a38813d08a981985ddf9c9eff5730e4b45480dd2ad64486591b00f9f4b66d': 100}
SHAPES=list(EXPECTED_CALLS)
METRICS=['plans','total_plan_time','calls','total_exec_time','rows','shared_blks_hit','shared_blks_read','shared_blks_dirtied','shared_blks_written','local_blks_hit','local_blks_read','local_blks_dirtied','local_blks_written','temp_blks_read','temp_blks_written','wal_records','wal_fpi','wal_bytes']
PERSISTENCE='3b2fe5b364dcbbd2dd19029b8f2b2b9514132cf4743b31ab6d854cb7bd9b5869'
def settings(value):
    check(isinstance(value,dict) and set(value)=={'serverVersionNum','preload','track','trackPlanning','computeQueryId','userid','dbid'},'PROFILE_SETTINGS_FIELDS')
    check(type(value['serverVersionNum']) is int and 170000<=value['serverVersionNum']<180000,'PROFILE_VERSION')
    check(isinstance(value['preload'],str) and 'pg_stat_statements' in [s.strip() for s in value['preload'].split(',')],'PROFILE_PRELOAD')
    check(value['track']=='all' and value['trackPlanning']=='on' and value['computeQueryId']=='on','PROFILE_TRACKING_OFF')
    check(all(type(value[k]) is int and 0<value[k]<2**32 for k in ['userid','dbid']),'PROFILE_SCOPE')
    return value

def snapshot(value,scope):
    check(isinstance(value,dict) and set(value)=={'statsReset','dealloc','entries'},'PROFILE_SNAPSHOT_FIELDS');base.timestamp(value['statsReset'])
    check(type(value['dealloc']) is int and 0<=value['dealloc']<2**53,'PROFILE_DEALLOC');check(isinstance(value['entries'],list) and len(value['entries'])<=256,'PROFILE_ENTRIES_BOUND')
    result={}
    for r in value['entries']:
        check(isinstance(r,dict) and set(r)==set(METRICS)|{'userid','dbid','toplevel','queryid','serverQuerySha256','querySha256'},'PROFILE_ENTRY_FIELDS')
        check(type(r['userid']) is int and type(r['dbid']) is int and r['userid']==scope['userid'] and r['dbid']==scope['dbid'] and type(r['toplevel']) is bool,'PROFILE_ENTRY_SCOPE')
        check(isinstance(r['queryid'],str) and re.fullmatch(r'-?[0-9]+',r['queryid']) and r['queryid']!='0','PROFILE_QUERY_ID')
        check(isinstance(r['serverQuerySha256'],str) and re.fullmatch('[a-f0-9]{64}',r['serverQuerySha256']) and (r['querySha256'] is None or r['querySha256'] in SHAPES),'PROFILE_MAPPING_HASH')
        for k in METRICS:check(base.finite(r[k]) and r[k]>=0 and (k.endswith('_time') or type(r[k]) is int and r[k]<2**53),'PROFILE_METRIC_TYPE')
        key=(r['userid'],r['dbid'],r['toplevel'],r['queryid']);check(key not in result,'PROFILE_DUPLICATE_ENTRY');result[key]=r
    return result

def validate_measurement(report,candidate,manifest_hash,benchmark,external,profile,client):
    validate_load(report,candidate,manifest_hash,benchmark,external)
    check(profile.get('schema')=='vexa-server-profile-v1' and profile.get('synthetic') is True and profile.get('acceptance') is False and profile.get('production') is False and profile.get('status')=='profiled','SERVER_PROFILE_REQUIRED')
    check(profile.get('candidate')==str(candidate) and profile.get('persistenceSha256')==PERSISTENCE==digest((candidate/'packages/ingestion/persistence/index.mjs').read_bytes()),'PROFILE_SOURCE_BINDING')
    check(profile.get('instrumentation')=={n:digest((CONTROL/'.github/scripts'/n).read_bytes()) for n in ['capacity-server-profile.mjs','capacity-query-profile.mjs']},'PROFILE_IMPLEMENTATION_BINDING')
    check(profile.get('cleanupErrors')==[],'PROFILE_CLEANUP_ERRORS');scope=settings(profile.get('settings'))
    ext=profile.get('extension');check(isinstance(ext,dict) and set(ext)=={'version','schema'} and isinstance(ext['version'],str) and re.fullmatch(r'[0-9]+(?:\.[0-9]+)+',ext['version']) and isinstance(ext['schema'],str) and re.fullmatch('[a-z_][a-z_0-9]*',ext['schema']),'PROFILE_EXTENSION')
    probe=profile.get('probe',{});check(probe=={'serverVersionNum':scope['serverVersionNum'],'preload':scope['preload'],'extension':ext},'PROFILE_PROBE_BINDING')
    w=profile.get('window',{});check(w.get('status')=='completed' and w.get('client')==client,'PROFILE_WINDOW_CLIENT_BINDING')
    scale=report['scales'][0];file=scale['files'][0];check(w.get('checkpoint')=={'jobId':file['jobId'],'importId':file['importId'],'offset':10000,'done':True,'fileHash':file['sha256']},'PROFILE_SQL_CHECKPOINT');check(base.timestamp(scale['startedAt'])<=base.timestamp(w.get('startedAt'))<=base.timestamp(w.get('finishedAt'))<=base.timestamp(report['processes'][0]['endedAt']),'PROFILE_WINDOW_BOUNDARY')
    check(client.get('schema')=='vexa-server-client-profile-v1' and client.get('success') is True and client.get('settingsVerified') is True,'PROFILE_CLIENT_STATUS')
    check(type(client.get('connections')) is int and 0<client['connections']<=1000 and isinstance(client.get('effectiveSettings'),list) and len(client['effectiveSettings'])==client['connections'],'PROFILE_EFFECTIVE_CONNECTIONS')
    for value in client['effectiveSettings']:check(settings(value)==scope,'PROFILE_EFFECTIVE_SETTINGS')
    cp=client.get('profile');comparison.validate_sql_profile(cp,cp.get('completed') if isinstance(cp,dict) else None);check(cp['failed']==0,'PROFILE_CLIENT_FAILURE')
    before=snapshot(w.get('before'),scope);after=snapshot(w.get('after'),scope)
    check(w['before']['statsReset']==w['after']['statsReset'] and w['before']['dealloc']==w['after']['dealloc'],'PROFILE_RESET_OR_EVICTION')
    check(set(before)<=set(after),'PROFILE_DISAPPEARED');computed=[]
    for key,r in after.items():
        old=before.get(key)
        if old:check(old['serverQuerySha256']==r['serverQuerySha256'] and old['querySha256']==r['querySha256'],'PROFILE_CHANGED_QUERY')
        delta={k:r[k]-(old[k] if old else 0) for k in METRICS};check(all(v>=0 for v in delta.values()),'PROFILE_COUNTER_RESET')
        if delta['calls'] or delta['plans']:computed.append({k:r[k] for k in ['userid','dbid','toplevel','queryid','querySha256','serverQuerySha256']}|{'beforePresent':old is not None}|delta)
    expected={'mapped':[r for r in computed if r['toplevel'] and r['querySha256']],'unmappedTopLevel':[r for r in computed if r['toplevel'] and not r['querySha256']],'nested':[r for r in computed if not r['toplevel']],'aggregation':'Separate partitions; never sum nested and top-level durations'}
    check(w.get('delta')==expected,'PROFILE_DELTA_RECOMPUTE');check(len(expected['mapped'])==6,'PROFILE_PRIMARY_AND_DUPLICATE_SHAPES')
    for shape in SHAPES:
        rows=[r for r in expected['mapped'] if r['querySha256']==shape];groups=[g for g in cp['groups'] if g['querySha256']==shape]
        check(len(rows)==len(groups)==1,'PROFILE_MAPPING_UNIQUE');check(rows[0]['calls']==groups[0]['count']==EXPECTED_CALLS[shape] and rows[0]['plans']>0 and groups[0]['failed']==0,'PROFILE_CALLS_AND_PLANS')

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
    receipt={'schema':'capacity-server-profile-v1','status':'FAILED','synthetic':True,'eventSha':args.event_sha,'correlation':correlation,'repository':os.environ.get('GITHUB_REPOSITORY'),'runId':os.environ.get('GITHUB_RUN_ID'),'runAttempt':os.environ.get('GITHUB_RUN_ATTEMPT'),'candidate':str(candidate),'control':str(CONTROL),'bootstrapOutcome':args.bootstrap_outcome,'commands':commands,'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'notProved':['commercial capacity or SLO','AI/inference/training','production acceptance'],'fixedScales':list(SCALES),'jobDeadlineMs':900000,'measurementTimeoutSeconds':MEASUREMENT_SECONDS}
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
        for stage,argv,timeout in [('preflight',['node',str(load),'--preflight'],60),('measurement',['node',str(CONTROL/'.github/scripts/capacity-server-profile.mjs')],MEASUREMENT_SECONDS),('source-postflight',['node',str(load),'--preflight'],60)]:
            command,out=run_process(argv,CONTROL,env,artifact/(stage+'.log'),life,timeout);commands.append(command)
            if stage=='measurement':
                try:evidence=bound_evidence(out,tmp)
                except ValueError:
                    if command['exit_code']==0:raise
            check(command['exit_code']==0 and command['process_group_stopped'],stage.upper()+'_FAILED')
            if stage!='measurement':
                parsed=json.loads(out);check(parsed.get('status')=='source-preflight-only' and parsed.get('dependencyManifestSha256')==manifest_hash and parsed.get('capacityMeasured') is False,'SOURCE_PREFLIGHT_INVALID')
        check(evidence is not None,'MEASUREMENT_EVIDENCE_MISSING');report=read_json(evidence/'report.json');external=inspect_owned(evidence,env);validate_measurement(report,candidate,manifest_hash,benchmark,external,read_json(evidence/'server-profile.json'),read_json(evidence/'client-profile.json'))
        for checkout in (CONTROL,candidate):check(not subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=checkout,env=env,text=True).strip(),'CHECKOUT_CHANGED')
        receipt['status']='MEASURED_10K_SERVER_PROFILE_DIAGNOSTIC_VERIFIED';code=0
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
