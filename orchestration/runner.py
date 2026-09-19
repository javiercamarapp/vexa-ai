#!/usr/bin/env python3
"""Bounded Codex build controller. No paid API fallback, no production deployment.
Candidate code runs in a Git worktree with Codex workspace-write sandbox. This is
not a security sandbox for hostile programs: use a disposable VM for that threat.
Control-plane tests/graph remain in the controller checkout, not candidate-owned.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def load_graph(path):
    graph = json.loads(Path(path).read_text())
    tasks = graph['tasks']
    ids = [t['id'] for t in tasks]
    if len(ids) != len(set(ids)):
        raise ValueError('duplicate task id')
    by_id = {t['id']: t for t in tasks}
    visiting, visited = set(), set()
    def visit(tid):
        if tid in visiting: raise ValueError('dependency cycle')
        if tid in visited: return
        if tid not in by_id: raise ValueError('unknown dependency')
        visiting.add(tid)
        for dep in by_id[tid]['depends_on']: visit(dep)
        visiting.remove(tid); visited.add(tid)
    for t in tasks:
        if not t['id'].replace('-', '').isalnum(): raise ValueError('unsafe task id')
        visit(t['id'])
        for p in t['allowed_paths']:
            if not p or Path(p).is_absolute() or '..' in Path(p).parts:
                raise ValueError('unsafe allowed path')
        if not t.get('acceptance'): raise ValueError('missing acceptance')
    return graph


def next_task(graph, state):
    for task in graph['tasks']:
        row = state.get(task['id'], {})
        if row.get('status') in ('accepted', 'verified', 'blocked'): continue
        if row.get('attempts', 0) >= graph['max_attempts_per_task']: continue
        if all(state.get(d, {}).get('status') == 'accepted' for d in task['depends_on']):
            return task
    return None


def allowed_changes(paths, allowed):
    return all(any(p == a or p.startswith(a.rstrip('/') + '/') for a in allowed) for p in paths)


def atomic_json(path, data):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    with temp.open('w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False); f.flush(); os.fsync(f.fileno())
    os.replace(temp, path)


def clean_environment():
    # Codex auth lives in its own auth file, not inherited provider API keys.
    keep = {'PATH','HOME','USER','LOGNAME','LANG','LC_ALL','TERM','TMPDIR','SHELL'}
    return {k: v for k, v in os.environ.items() if k in keep}


def run_bounded(argv, cwd, log_path, timeout, env=None):
    with Path(log_path).open('wb') as log:
        proc = subprocess.Popen(argv, cwd=cwd, env=env, stdout=log,
                                stderr=subprocess.STDOUT, start_new_session=True)
        try:
            return proc.wait(timeout=timeout)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            try: os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError: pass
            try: proc.wait(timeout=3)
            except subprocess.TimeoutExpired: pass
            # A dead group leader does not imply that all descendants exited.
            # Always kill surviving members, including children ignoring SIGTERM.
            try: os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError: pass
            proc.wait()
            return 124


def git(root, *args):
    return subprocess.check_output(['git','-C',str(root),*args], text=True, timeout=30).strip()


def digest_control(root):
    # Include all tracked non-application files. Changes in shared Git metadata
    # cannot be prevented by hashes; isolated VM remains needed for hostile agents.
    files = git(root, 'ls-files').splitlines()
    return {p: hashlib.sha256((root/p).read_bytes()).hexdigest()
            for p in files if (root/p).is_file()}


def candidate_signature(candidate):
    paths = sorted(set(git(candidate,'ls-files').splitlines() +
                       git(candidate,'ls-files','--others','--exclude-standard').splitlines()))
    signature = {}
    for p in paths:
        f = candidate/p
        if f.is_symlink(): signature[p] = 'SYMLINK:' + os.readlink(f)
        elif f.is_file(): signature[p] = hashlib.sha256(f.read_bytes()).hexdigest()
        else: signature[p] = 'MISSING'
    return signature


def changed_paths(candidate, baseline):
    tracked = git(candidate,'diff','--name-only',baseline).splitlines()
    untracked = git(candidate,'ls-files','--others','--exclude-standard').splitlines()
    return sorted(set(tracked + untracked))


def gate_path(root, task):
    p = (root / task['acceptance']).resolve()
    if root.resolve() not in p.parents: raise ValueError('gate escapes root')
    if not p.is_file(): raise FileNotFoundError(f'Acceptance gate not authored: {p}')
    return p


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['status','run','accept'])
    parser.add_argument('--task')
    parser.add_argument('--max-rounds',type=int,default=1)
    parser.add_argument('--max-minutes',type=int,default=30)
    parser.add_argument('--auto-accept',action='store_true',help='Only for tasks explicitly marked auto_accept in graph')
    args=parser.parse_args()
    if not 1<=args.max_rounds<=30 or not 1<=args.max_minutes<=480:
        parser.error('limits: rounds 1..30, minutes 1..480')
    end=time.monotonic()+args.max_minutes*60
    def remaining_budget():
        remaining=end-time.monotonic()
        if remaining<=0: raise SystemExit('Time budget reached')
        return remaining
    graph=load_graph(ROOT/'orchestration/graph.json')
    runtime=ROOT/'.runtime'
    sp=runtime/'state.json'; state=json.loads(sp.read_text()) if sp.exists() else {}
    if args.action=='status':
        for t in graph['tasks']:
            row=state.get(t['id'],{})
            print(t['id'],row.get('status','pending'),'attempts='+str(row.get('attempts',0)),
                  'gate='+('present' if (ROOT/t['acceptance']).is_file() else 'MISSING'))
        return
    runtime.mkdir(exist_ok=True)
    with (runtime/'lock').open('a+') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: raise SystemExit('Another controller is running')
        state=json.loads(sp.read_text()) if sp.exists() else {}
        return execute(args,graph,runtime,sp,state,end,remaining_budget,parser)


def execute(args,graph,runtime,sp,state,end,remaining_budget,parser):
    if git(ROOT,'status','--porcelain'):
        raise SystemExit('Controller checkout must be clean; commit/review changes first')
    if args.action=='accept':
        if not args.task: parser.error('--task required')
        task=next((t for t in graph['tasks'] if t['id']==args.task),None)
        if task is None: raise SystemExit('Unknown task')
        row=state.get(args.task,{})
        if row.get('status')!='verified': raise SystemExit('Task is not verified')
        if git(ROOT,'rev-parse','HEAD')!=row['baseline']: raise SystemExit('Baseline changed: reverify candidate first')
        candidate=Path(row['worktree']); gate=gate_path(ROOT,task)
        if git(candidate,'status','--porcelain') or git(candidate,'rev-parse','HEAD')!=row['commit']:
            raise SystemExit('Candidate changed after verification')
        controls=digest_control(ROOT); signature=candidate_signature(candidate)
        code=run_bounded(['node','--test',str(gate)],ROOT,runtime/f'{args.task}-recheck.log',min(300,remaining_budget()),
                         {**clean_environment(),'VEXA_CANDIDATE':str(candidate)})
        if code: raise SystemExit('Acceptance recheck failed')
        if candidate_signature(candidate)!=signature or digest_control(ROOT)!=controls:
            raise SystemExit('Files changed during acceptance recheck')
        if git(ROOT,'rev-parse','HEAD')!=row['baseline'] or git(candidate,'rev-parse','HEAD')!=row['commit']:
            raise SystemExit('Git HEAD changed during acceptance recheck')
        git(ROOT,'merge','--ff-only',row['commit'])
        row['status']='accepted';atomic_json(sp,state)
        print(args.task,'accepted');return
    # No live worker invoked until authentication and every selected gate are ready.
    try:
        auth=subprocess.run(['codex','login','status'],capture_output=True,text=True,
                            env=clean_environment(),timeout=min(15,remaining_budget()))
    except subprocess.TimeoutExpired:
        raise SystemExit('Codex authentication timeout; no worker launched')
    if auth.returncode or 'ChatGPT' not in auth.stdout+auth.stderr:
        raise SystemExit('Codex subscription auth required; no API-key fallback')
    for _ in range(args.max_rounds):
        if (runtime/'STOP').exists(): print('STOP requested');break
        task=next_task(graph,state)
        if task is None: print('No executable task; inspect status/dependencies/approvals');break
        try: gate=gate_path(ROOT,task)
        except FileNotFoundError as e: print(e);break
        if task.get('requires_approval',False):
            print(task['id'],'requires human approval; execute interactive phase first');break
        remaining=int(end-time.monotonic())
        if remaining<10: print('Time budget reached');break
        tid=task['id']; prior=state.get(tid,{})
        attempt=prior.get('attempts',0)+1
        baseline=git(ROOT,'rev-parse','HEAD'); controls=digest_control(ROOT)
        candidate=runtime/f'{tid}-{attempt}-{int(time.time())}'
        git(ROOT,'worktree','add','--detach',str(candidate),baseline)
        row={'status':'running','attempts':attempt,'baseline':baseline,'worktree':str(candidate)}
        state[tid]=row;atomic_json(sp,state)
        prompt=(ROOT/task['prompt']).read_text()
        prompt+='\n\nCURRENT TASK ONLY: '+task.get('objective','Satisfy the specified kernel contract.')
        prompt+='\nDo not implement the whole phase. Perform only this bounded task. If it requires more than one independent change, report the split before implementing.'
        prompt+='\n\nCONTROL: Write only '+', '.join(task['allowed_paths'])+'. Do not edit tests/acceptance, orchestration, docs, .git, credentials, or any other checkout. No network requests, paid APIs, production, push or deployment. Do not commit; controller owns commits. Use local code and fixtures. Report blockers honestly.'
        logfile=runtime/f'{tid}-{attempt}-agent.log'
        argv=['codex','exec','--ignore-user-config','--model','gpt-6-astra','--sandbox','workspace-write',
              '--color','never','-C',str(candidate),prompt]
        code=run_bounded(argv,candidate,logfile,min(remaining,graph['turn_timeout_seconds']),clean_environment())
        row['worker_exit']=code
        paths=changed_paths(candidate,baseline)
        guard=(digest_control(ROOT)==controls and git(ROOT,'rev-parse','HEAD')==baseline
               and git(candidate,'rev-parse','HEAD')==baseline
               and allowed_changes(paths,task['allowed_paths'])
               and not any((candidate/p).is_symlink() for p in paths))
        if not guard: row['status']='blocked';row['reason']='protected path/control-plane guard';atomic_json(sp,state);print(tid,'BLOCKED guard');break
        if code!=0:
            row['status']='failed';row['reason']='worker timeout/error; candidate preserved, baseline unchanged'
            atomic_json(sp,state);print(tid,row['reason']);continue
        remaining=int(end-time.monotonic())
        if remaining<=0:
            row['status']='failed';row['reason']='budget before validation';atomic_json(sp,state);break
        before_gate=candidate_signature(candidate)
        testcode=run_bounded(['node','--test',str(gate)],ROOT,runtime/f'{tid}-{attempt}-gate.log',min(remaining,300),
                            {**clean_environment(),'VEXA_CANDIDATE':str(candidate)})
        row['gate_exit']=testcode
        if candidate_signature(candidate)!=before_gate:
            row['status']='blocked';row['reason']='candidate mutated during acceptance'
            atomic_json(sp,state);print(tid,'BLOCKED verification mutation');break
        if testcode:
            row['status']='failed';row['reason']='acceptance failed'
        elif not paths:
            row['status']='verified';row['commit']=baseline;row['reason']='existing behavior passed; no patch'
        else:
            git(candidate,'add','--',*paths)
            git(candidate,'commit','-m',f'feat({tid}): candidato verificado por contrato')
            row['commit']=git(candidate,'rev-parse','HEAD');row['status']='verified'
        # Commit hooks or test processes must not mutate controller/candidate after checks.
        if digest_control(ROOT)!=controls or git(ROOT,'rev-parse','HEAD')!=baseline:
            row['status']='blocked';row['reason']='controller changed during validation'
        if row['status']=='verified' and (git(candidate,'status','--porcelain') or candidate_signature(candidate)!=before_gate):
            row['status']='blocked';row['reason']='candidate changed after validation/commit'
        atomic_json(sp,state);print(tid,row['status'])
        if row['status']=='verified' and args.auto_accept and task.get('auto_accept',False):
            git(ROOT,'merge','--ff-only',row['commit']);row['status']='accepted';atomic_json(sp,state)
        else:
            # One reviewed change at a time: not a metric of finished software.
            if row['status'] in ('verified','blocked'): break
    print('State:',sp)

if __name__=='__main__':
    main()
