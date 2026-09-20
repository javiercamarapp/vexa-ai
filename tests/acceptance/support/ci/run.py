#!/usr/bin/env python3
"""Local/main-trust job runner. Not an untrusted-code sandbox."""
import argparse, hashlib, json, os, pathlib, platform, re, shutil, subprocess, sys, signal, tempfile, time, uuid
from contract import JOBS, GATES
from lifecycle import Lifecycle
CONTROL = pathlib.Path(__file__).resolve().parents[4]
EXCLUDED = {'.git', '.runtime', 'private', 'node_modules', '.next', '__pycache__'}
def fingerprint(root):
    h = hashlib.sha256()
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED)
        for name in sorted(dirs + files):
            p = pathlib.Path(base)/name
            if p.is_symlink(): raise ValueError('SYMLINK_INPUT: '+str(p.relative_to(root)))
        for name in sorted(files):
            p = pathlib.Path(base)/name
            if name.startswith('.env'): raise ValueError('ENV_INPUT_FORBIDDEN')
            h.update(str(p.relative_to(root)).encode()); h.update(str(p.stat().st_mode & 0o777).encode()); h.update(p.read_bytes())
    return h.hexdigest()
def environment(tmp, candidate):
    env = {k: os.environ[k] for k in ('PATH','HOME','TMPDIR','LANG','LC_ALL','SYSTEMROOT') if k in os.environ}
    env.update(CI='1', NEXT_TELEMETRY_DISABLED='1', PYTHONDONTWRITEBYTECODE='1', VEXA_CANDIDATE=str(candidate), NPM_CONFIG_USERCONFIG='/dev/null', NPM_CONFIG_GLOBALCONFIG=str(tmp/'empty-global-npmrc'))
    return env
def sanitize(s):
    return re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[JWT_REDACTED]', s)
def execute(argv, cwd, env, artifacts, records, timeout=650, lifecycle=None):
    start=time.monotonic(); own=lifecycle is None; life=lifecycle or Lifecycle(artifacts)
    if own: life.install()
    child=None; out=''; code=1; timed=False; cleanup=None; process_cleanup=True
    try:
        if life.cancelled: code=128+life.cancelled
        else:
            child=subprocess.Popen(argv,cwd=cwd,env=life.environment(env),text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
            while True:
                if life.cancelled: code=128+life.cancelled; break
                remaining=timeout-(time.monotonic()-start)
                if remaining<=0: code=124;timed=True;break
                try:
                    out,_=child.communicate(timeout=min(.1,remaining));code=child.returncode;break
                except subprocess.TimeoutExpired: pass
    finally:
        if child is not None:
            try:
                tail=life.stop(child)
                if tail: out=tail
            except Exception:
                process_cleanup=False
                if code==0: code=1
                # Preserve Docker cleanup and records even if process signalling fails.
                try: child.kill(); child.communicate(timeout=5)
                except Exception: pass
        cleanup=life.cleanup()
        if life.cancelled: code=128+life.cancelled
        if not cleanup['verified'] and code==0:code=1
        log=artifacts/('%02d.log'%len(records))
        with open(log,'w',opener=lambda p,f:os.open(p,f,0o600)) as f:f.write(sanitize(out))
        records.append({'argv':list(map(str,argv)), 'cwd':str(cwd), 'exit_code':code, 'timeout':timed, 'cancelled':life.cancelled or None, 'seconds':round(time.monotonic()-start,2), 'log':str(log), 'cleanup':cleanup, 'process_cleanup_verified':process_cleanup})
        with open(artifacts/('%02d.command.json'%(len(records)-1)),'w',opener=lambda p,f:os.open(p,f,0o600)) as f:
            f.write(json.dumps(records[-1],indent=2)+'\n');f.flush();os.fsync(f.fileno())
        if own: life.restore()
    if code: raise JobFailure(code, out)
    if '--test' in argv:
        counts = re.findall(r'^# tests (\d+)$',out,re.M)
        if not counts or int(counts[-1])==0 or not any(not re.search(r'\.(?:mjs|cjs|js|ts)$', name) for name in re.findall(r'^\s*# Subtest: (.+)$',out,re.M)): raise JobFailure(1,'CRITICAL_EMPTY_TEST_RUN')
        if re.search(r'^# (?:skipped|todo|fail|cancelled) [1-9]',out,re.M): raise JobFailure(1,'CRITICAL_SKIP_OR_FAILURE')
    return out
class JobFailure(Exception):
    def __init__(self, code, output): self.code=code; self.output=output

def main():
    p=argparse.ArgumentParser(); p.add_argument('--job',choices=JOBS,required=True); p.add_argument('--candidate',type=pathlib.Path,required=True); p.add_argument('--event-sha')
    args=p.parse_args(); candidate=args.candidate.resolve()
    if candidate==CONTROL: p.error('candidate must be materialized separately from control')
    artifacts=pathlib.Path(tempfile.mkdtemp(prefix='vexa-ci-'+args.job+'-')); artifacts.chmod(0o700)
    life=Lifecycle(artifacts); life.install()
    records=[]; env=environment(artifacts,candidate); before=None; control_before=None; sha=None
    receipt={'task_id':'F01-05','job':args.job,'nonce':str(uuid.uuid4()),'control_sha':sha,'candidate_commit_sha':None,'candidate_working_tree_fingerprint':before,'control_fingerprint':control_before,'run_id':'pending','gates':GATES,'platform':platform.platform(),'commands':records,'status':'infra_blocked','cleanup':{'verified':False}}
    run=lambda argv,cwd=CONTROL: execute(argv,cwd,env,artifacts,records,lifecycle=life)
    exit_code=1
    try:
        before=fingerprint(candidate); control_before=fingerprint(CONTROL)
        sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=CONTROL,text=True).strip()
        receipt.update(control_sha=sha,candidate_working_tree_fingerprint=before,control_fingerprint=control_before)
        if life.cancelled: raise JobFailure(128+life.cancelled,'cancelled')
        if args.event_sha:
            if not re.fullmatch('[0-9a-f]{40}',args.event_sha): raise ValueError('EVENT_SHA_INVALID')
            if os.environ.get('GITHUB_REF')!='refs/heads/main' or os.environ.get('GITHUB_EVENT_NAME') not in ('push','workflow_dispatch'): raise ValueError('MAIN_TRUST_REQUIRED')
            for root in (CONTROL,candidate):
                if subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()!=args.event_sha: raise ValueError('EVENT_SHA_MISMATCH')
                if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): raise ValueError('DIRTY_EVENT_CHECKOUT')
            receipt['candidate_commit_sha']=args.event_sha
        if run(['node','--version']).strip()!='v26.7.0': raise ValueError('NODE_VERSION')
        if sys.version_info < (3,9): raise ValueError('PYTHON_REQUIRES_3_9')
        acceptance=CONTROL/'tests/acceptance'
        if args.job=='control-kernel':
            files=['economics.test.mjs']+['F00-%02d.test.mjs'%i for i in range(1,6)]+['foundation-negative.test.mjs']
            run(['node','--test','--test-reporter=tap']+[str(acceptance/f) for f in files])
            run(['python3','-B','-m','unittest','discover','-s','tests/controller','-v'])
            run(['node','--test','--test-reporter=tap','tests/tooling/scaffold-copy.test.mjs'])
        elif args.job=='web-quality':
            run(['node',str(pathlib.Path(__file__).with_name('web.mjs')),str(candidate)])
            run(['node','--test','--test-reporter=tap',str(acceptance/'F01-01.test.mjs')])
        elif args.job=='sql-integration':
            run(['node',str(pathlib.Path(__file__).with_name('sql-preflight.mjs'))])
            run(['node','--test','--test-reporter=tap',str(acceptance/'F01-03.test.mjs')])
        else:
            support=acceptance/'support/F01-02'
            # Integration contract: both the adapter and its actual harness import
            # must be in this trusted checkout. Never load candidate infrastructure.
            if not (support/'infra.mjs').is_file() or "from './infra.mjs'" not in (support/'harness.mjs').read_text():
                raise ValueError('AUTH_ADAPTER_PENDING: trusted own Auth/Mailpit adapter absent; shared stack forbidden')
            run(['node','--test','--test-reporter=tap',str(acceptance/'F01-02.test.mjs')])
            run(['node','--test','--test-reporter=tap',str(acceptance/'F01-04.test.mjs')])
        receipt['status']='pass'; exit_code=0
    except JobFailure as e:
        # Only precise functional diagnostics count as killed product mutants.
        receipt['status']='cancelled' if life.cancelled else 'timeout' if e.code==124 else 'product_fail' if re.search(r'TS2322|READ_A:conversations:a|SQLSTATE.?42601',e.output) else 'failed_unclassified'
        receipt['failure_exit']=e.code; exit_code=e.code if 0<e.code<256 else 1
    except Exception as e: receipt['reason']=str(e)
    finally:
        try:
            receipt['candidate_working_tree_fingerprint_after']=fingerprint(candidate)
            receipt['control_fingerprint_after']=fingerprint(CONTROL)
            if (before is not None and before!=receipt['candidate_working_tree_fingerprint_after']) or (control_before is not None and control_before!=receipt['control_fingerprint_after']):
                receipt['status']='integrity_fail'; exit_code=1
        except Exception as e: receipt['status']='integrity_fail';receipt['reason']=str(e);exit_code=1
        receipt['cleanup']=life.cleanup()
        if not receipt['cleanup']['verified']:
            receipt['status']='cleanup_failed'
            if exit_code==0: exit_code=1
        if life.cancelled:
            receipt['status']='cancelled'; exit_code=128+life.cancelled
        receipt['exit_code']=exit_code
        with open(artifacts/'receipt.json','w',opener=lambda p,f:os.open(p,f,0o600)) as f:
            f.write(json.dumps(receipt,indent=2)+'\n'); f.flush(); os.fsync(f.fileno())
        (artifacts/'receipt.json').chmod(0o600)
        print(json.dumps({'receipt':str(artifacts/'receipt.json'),'status':receipt['status'],'exit_code':exit_code}))
    life.restore()
    return exit_code
if __name__=='__main__': sys.exit(main())
