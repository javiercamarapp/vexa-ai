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
        if row.get('status') in ('accepted', 'verified', 'blocked', 'prepared', 'running'): continue
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



def acceptance_environment(task, row):
    """Narrow live-gate environment; never used by model workers or auto-run.

    approval_note is an operator attestation, not a grant of account permission.
    The supervisor must match it to the real decision before invoking verify.
    """
    env = clean_environment()
    note = row.get('approval_note', '')
    live_gates = {
        'F03-01': ('VEXA_HUBSPOT_S01_CONFIG', 'VEXA_HUBSPOT_TOKEN',
                   'VEXA_HUBSPOT_RECONCILIATION_KEY', 'VEXA_HUBSPOT_APPROVAL_REFERENCE'),
        'F03-02': ('VEXA_ZENDESK_S02_CONFIG', 'VEXA_ZENDESK_TOKEN',
                   'VEXA_ZENDESK_RECONCILIATION_KEY', 'VEXA_ZENDESK_APPROVAL_REFERENCE'),
        'F08-01': ('VEXA_RELEASE_MANIFEST', 'VEXA_RELEASE_VERIFICATION_AUTHORIZATION',
                   'VEXA_RELEASE_APPROVAL_REFERENCE'),
    }
    keys = live_gates.get(task['id'])
    if (keys and task.get('requires_approval') is True
            and isinstance(note, str) and note.strip()):
        for key in keys[:-1]:
            if key in os.environ:
                env[key] = os.environ[key]
        env[keys[-1]] = note
    return env

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


def receipt_log(runtime, row, kind):
    """Never reuse a prior attempt's evidence path, even after an authorized reset."""
    path = runtime/f'{Path(row["worktree"]).name}-{time.time_ns()}-{kind}.log'
    row.setdefault('logs', []).append({'kind': kind, 'file': path.name})
    return path


def seal_log(row, path):
    entry = next(e for e in row['logs'] if e['file'] == path.name)
    entry['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()


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


def interactive_signature(root, include_ignored=False):
    """Content, type and mode; ignored candidate files also affect verification."""
    others = ['ls-files', '--others']
    if not include_ignored: others.append('--exclude-standard')
    paths = sorted(set(git(root, 'ls-files').splitlines() + git(root, *others).splitlines()))
    result = {}
    for p in paths:
        f = root/p
        # Never follow a symlink, including an ancestor replaced by a symlink.
        if any((root/Path(*Path(p).parts[:i])).is_symlink() for i in range(1, len(Path(p).parts)+1)):
            result[p] = 'SYMLINK'
        elif f.is_file():
            result[p] = [f.stat().st_mode, hashlib.sha256(f.read_bytes()).hexdigest()]
        else:
            result[p] = 'MISSING'
    return result


def interactive_context(task, state):
    gate = gate_path(ROOT, task)
    # Freeze dependency receipts by digest, not recursively embedding entire DAG history.
    dependencies = {d: hashlib.sha256(json.dumps(state.get(d, {}), sort_keys=True).encode()).hexdigest()
                    for d in task['depends_on']}
    return {'task': task, 'dependencies': dependencies,
            'gate': [str(gate), hashlib.sha256(gate.read_bytes()).hexdigest()],
            'control': interactive_signature(ROOT)}


def check_interactive_context(task, state, row):
    if not all(state.get(d, {}).get('status') == 'accepted' for d in task['depends_on']):
        raise ValueError('Dependencies must be accepted')
    if interactive_context(task, state) != row['prepared_context']:
        raise ValueError('Task/dependencies/gate/control changed since prepare')
    if git(ROOT, 'rev-parse', 'HEAD') != row['baseline']:
        raise ValueError('Baseline changed since prepare')


def interactive(args, graph, runtime, sp, state, remaining_budget, parser):
    if not args.task: parser.error('--task required')
    task = next((t for t in graph['tasks'] if t['id'] == args.task), None)
    if task is None: raise SystemExit('Unknown task')
    tid = task['id']; prior = state.get(tid, {})
    if args.action == 'prepare':
        if prior.get('status') in ('prepared', 'running', 'verified', 'accepted', 'blocked'):
            raise SystemExit('Existing candidate requires review/recovery; not overwritten')
        if prior.get('attempts', 0) >= graph['max_attempts_per_task']:
            raise SystemExit('Attempt ceiling reached')
        if not all(state.get(d, {}).get('status') == 'accepted' for d in task['depends_on']):
            raise SystemExit('Dependencies must be accepted')
        context = interactive_context(task, state)
        if (runtime/'STOP').exists(): raise SystemExit('STOP requested')
        # Worktree checks out tracked files only. Reject known sensitive tracked paths.
        if any(p.startswith('private/') or any(part in ('.env', 'credentials', 'auth.json')
               or part.startswith('.env.') for part in Path(p).parts) for p in context['control']):
            raise SystemExit('Sensitive tracked path: cannot prepare worktree')
        remaining_budget()
        attempt = prior.get('attempts', 0) + 1
        baseline = git(ROOT, 'rev-parse', 'HEAD')
        candidate = runtime/f'{tid}-{attempt}-{time.time_ns()}'
        row = {'status': 'prepared', 'attempts': attempt, 'baseline': baseline,
               'worktree': str(candidate), 'prepared_context': context,
               'recovery_count': prior.get('recovery_count', 0),
               'history': prior.get('history', []) + ([{k: v for k, v in prior.items() if k != 'history'}] if prior else [])}
        # Record the attempt before Git so an interrupted setup cannot silently retry.
        log = receipt_log(runtime, row, 'prepare')
        state[tid] = row; atomic_json(sp, state)
        try:
            log.write_text(git(ROOT, 'worktree', 'add', '--detach', str(candidate), baseline) + '\n')
            check_interactive_context(task, state, row)
        except (Exception, SystemExit) as exc:
            row['status'] = 'blocked'; row['reason'] = str(exc)
            log.write_text(log.read_text() + str(exc) if log.exists() else str(exc))
            seal_log(row, log); atomic_json(sp, state); raise
        seal_log(row, log); atomic_json(sp, state)
        print(tid, 'prepared', candidate); return
    if prior.get('status') != 'prepared': raise SystemExit('Task is not prepared')
    row = prior
    note = (args.approval_note or '').strip()
    if task.get('requires_approval') and not note:
        raise SystemExit('--approval-note must reference an explicit operator decision')
    if note: row['approval_note'] = note  # Manual attestation, not authentication/legal validation.
    log = receipt_log(runtime, row, 'verify')
    atomic_json(sp, state)
    try:
        check_interactive_context(task, state, row)
        candidate = Path(row['worktree'])
        if git(candidate, 'rev-parse', 'HEAD') != row['baseline']:
            raise ValueError('Candidate HEAD changed since prepare')
        before = interactive_signature(candidate, True)
        paths = changed_paths(candidate, row['baseline'])
        ignored = git(candidate, 'ls-files', '--others', '--ignored', '--exclude-standard').splitlines()
        protected = ('orchestration', 'tests/acceptance', 'private', '.git')
        if (ignored or not allowed_changes(paths, task['allowed_paths'])
                or any(p == a or p.startswith(a + '/') for p in paths + ignored for a in protected)
                or 'SYMLINK' in before.values()):
            raise ValueError('Protected path or symlink guard')
        row['gate_exit'] = run_bounded(['node', '--test', str(gate_path(ROOT, task))], ROOT, log,
                                      min(graph['turn_timeout_seconds'], remaining_budget()),
                                      {**acceptance_environment(task, row), 'VEXA_CANDIDATE': str(candidate)})
        check_interactive_context(task, state, row)
        if (interactive_signature(candidate, True) != before
                or git(candidate, 'rev-parse', 'HEAD') != row['baseline']):
            raise ValueError('Candidate mutated during verification')
        if row['gate_exit']:
            row['status'] = 'failed'; row['reason'] = 'Acceptance failed; candidate and log preserved'
            atomic_json(sp, state); raise SystemExit(row['reason'])
        remaining_budget()
        if paths:
            git(candidate, 'add', '--', *paths)
            git(candidate, 'commit', '-m', f'feat({tid}): candidato interactivo verificado')
        commit = git(candidate, 'rev-parse', 'HEAD')
        check_interactive_context(task, state, row)
        if (interactive_signature(candidate, True) != before or git(candidate, 'status', '--porcelain')
                or (paths and git(candidate, 'rev-parse', 'HEAD^') != row['baseline'])):
            raise ValueError('Candidate changed after validation/commit')
        row.update(status='verified', commit=commit, verified_signature=before)
        row['reason'] = 'Gate passed' if paths else 'Existing behavior passed; no patch'
        seal_log(row, log); atomic_json(sp, state); print(tid, 'verified')
    except (Exception, SystemExit) as exc:
        if row['status'] != 'failed': row['status'] = 'blocked'
        row['reason'] = str(exc)
        with log.open('a') as f: f.write('\nController: ' + str(exc) + '\n')
        seal_log(row, log); atomic_json(sp, state)
        raise SystemExit(str(exc))


def recover_task(args, graph, runtime, sp, state):
    """Explicit operator-authorized new attempt budget, never an acceptance bypass."""
    if not (runtime/'STOP').exists(): raise SystemExit('STOP required before recovery')
    note = (args.approval_note or '').strip()
    if not note: raise SystemExit('--approval-note must explain reviewed cause and new bounded cycle')
    task = next((t for t in graph['tasks'] if t['id'] == args.task), None)
    if task is None: raise SystemExit('Unknown task; --task required')
    prior = state.get(task['id'], {})
    allowed = ('verified',) if args.action == 'reject' else ('failed', 'blocked')
    if prior.get('status') not in allowed:
        raise SystemExit('Reject only for verified candidates' if args.action == 'reject' else
                         'Recovery only for failed/blocked; investigate running processes separately')
    if not all(state.get(d, {}).get('status') == 'accepted' for d in task['depends_on']):
        raise SystemExit('Dependencies must be accepted before recovery')
    gate = gate_path(ROOT, task)
    history = prior.get('history', []) + [{k: v for k, v in prior.items() if k != 'history'}]
    state[task['id']] = {'status': 'pending', 'attempts': 0, 'history': history,
        'recovery_count': prior.get('recovery_count', 0) + 1,
        'recovery_action': args.action, 'recovery_note': note,
        'recovery_baseline': git(ROOT, 'rev-parse', 'HEAD'),
        'recovery_gate_sha256': hashlib.sha256(gate.read_bytes()).hexdigest()}
    atomic_json(sp, state)
    print(task['id'], 'recovered to pending; history preserved, STOP remains, no candidate accepted')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['status','run','accept','prepare','verify','recover','reject'])
    parser.add_argument('--task')
    parser.add_argument('--approval-note', help='Manual attestation referencing an explicit operator decision')
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
            if row.get('status') == 'running': print('  Requires recovery; do not relaunch blindly')
        return
    runtime.mkdir(exist_ok=True)
    with (runtime/'lock').open('a+') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: raise SystemExit('Another controller is running')
        state=json.loads(sp.read_text()) if sp.exists() else {}
        graph=load_graph(ROOT/'orchestration/graph.json')
        return execute(args,graph,runtime,sp,state,end,remaining_budget,parser)


def execute(args,graph,runtime,sp,state,end,remaining_budget,parser):
    if git(ROOT,'status','--porcelain'):
        raise SystemExit('Controller checkout must be clean; commit/review changes first')
    if args.action in ('recover', 'reject'):
        remaining_budget()
        return recover_task(args,graph,runtime,sp,state)
    if args.action in ('prepare', 'verify'):
        return interactive(args,graph,runtime,sp,state,remaining_budget,parser)
    if args.action=='accept':
        if not args.task: parser.error('--task required')
        task=next((t for t in graph['tasks'] if t['id']==args.task),None)
        if task is None: raise SystemExit('Unknown task')
        row=state.get(args.task,{})
        if row.get('status')!='verified': raise SystemExit('Task is not verified')
        if 'prepared_context' in row:
            try: check_interactive_context(task,state,row)
            except (ValueError, OSError) as exc: raise SystemExit(str(exc))
        if git(ROOT,'rev-parse','HEAD')!=row['baseline']: raise SystemExit('Baseline changed: reverify candidate first')
        candidate=Path(row['worktree']); gate=gate_path(ROOT,task)
        if git(candidate,'status','--porcelain') or git(candidate,'rev-parse','HEAD')!=row['commit']:
            raise SystemExit('Candidate changed after verification')
        controls=digest_control(ROOT); signature=candidate_signature(candidate)
        if 'verified_signature' not in row:
            raise SystemExit('Legacy receipt lacks full signature; reject and verify a fresh candidate')
        if interactive_signature(candidate,True)!=row['verified_signature']:
            raise SystemExit('Candidate changed after verification')
        # Test what Git can actually materialize, never just the original worktree.
        probe=runtime/f'promote-{args.task}-{time.time_ns()}'
        git(ROOT,'-c','core.hooksPath=/dev/null','worktree','add','--detach',str(probe),row['commit'])
        row['promotion_probe']=str(probe)
        promoted_signature=interactive_signature(probe,True)
        root_signature=interactive_signature(ROOT)
        changed=set(git(ROOT,'diff','--name-only',row['baseline'],row['commit']).splitlines())
        recheck_log=receipt_log(runtime,row,'recheck');atomic_json(sp,state)
        if (promoted_signature!=row['verified_signature'] or any(
                root_signature.get(p)!=v for p,v in promoted_signature.items() if p not in changed)):
            reason='Candidate/baseline differs from clean commit materialization; reject and correct'
            recheck_log.write_text(reason+'\n');seal_log(row,recheck_log);atomic_json(sp,state)
            raise SystemExit(reason)
        code=run_bounded(['node','--test',str(gate)],ROOT,recheck_log,min(graph['turn_timeout_seconds'],remaining_budget()),
                         {**acceptance_environment(task, row),'VEXA_CANDIDATE':str(probe)})
        seal_log(row,recheck_log);atomic_json(sp,state)
        if code: raise SystemExit('Acceptance recheck failed')
        if (interactive_signature(probe,True)!=promoted_signature
                or git(probe,'rev-parse','HEAD')!=row['commit']):
            raise SystemExit('Files changed during acceptance recheck')
        if candidate_signature(candidate)!=signature or digest_control(ROOT)!=controls:
            raise SystemExit('Files changed during acceptance recheck')
        if git(ROOT,'rev-parse','HEAD')!=row['baseline'] or git(candidate,'rev-parse','HEAD')!=row['commit']:
            raise SystemExit('Git HEAD changed during acceptance recheck')
        if 'prepared_context' in row:
            try: check_interactive_context(task,state,row)
            except (ValueError, OSError) as exc: raise SystemExit(str(exc))
        if interactive_signature(candidate,True)!=row['verified_signature']:
            raise SystemExit('Files changed during acceptance recheck')
        # Fast-forward must not run a post-merge hook after the final checks.
        git(ROOT,'-c','core.hooksPath=/dev/null','merge','--ff-only',row['commit'])
        row['status']='accepted';atomic_json(sp,state)
        # Successful probe is disposable; failed probes remain for diagnosis.
        git(ROOT,'worktree','remove','--force',str(probe))
        row['promotion_probe_removed']=True;atomic_json(sp,state)
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
        for tid, row in state.items():
            if row.get('status') == 'running': print(tid, 'requires recovery; not relaunched')
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
        candidate=runtime/f'{tid}-{attempt}-{time.time_ns()}'
        git(ROOT,'worktree','add','--detach',str(candidate),baseline)
        row={'status':'running','attempts':attempt,'baseline':baseline,'worktree':str(candidate),
             'recovery_count':prior.get('recovery_count',0),
             'history':prior.get('history',[])+([{k:v for k,v in prior.items() if k!='history'}] if prior else [])}
        state[tid]=row;atomic_json(sp,state)
        prompt=(ROOT/task['prompt']).read_text()
        prompt+=f'\n\nCURRENT TASK ONLY [{tid}]: '+task.get('objective','Satisfy the specified kernel contract.')
        prompt+='\nDo not implement the whole phase. Perform only this bounded task. If it requires more than one independent change, report the split before implementing.'
        prompt+='\n\nCONTROL: Write only '+', '.join(task['allowed_paths'])+'. Do not edit tests/acceptance, orchestration, docs, .git, credentials, or any other checkout. No network requests, paid APIs, production, push or deployment. Do not commit; controller owns commits. Use local code and fixtures. Report blockers honestly.'
        logfile=receipt_log(runtime,row,'agent');atomic_json(sp,state)
        argv=['codex','exec','--ignore-user-config','--model','gpt-6-astra','--sandbox','workspace-write',
              '--color','never','-C',str(candidate),prompt]
        code=run_bounded(argv,candidate,logfile,min(remaining,graph['turn_timeout_seconds']),clean_environment())
        row['worker_exit']=code;seal_log(row,logfile)
        paths=changed_paths(candidate,baseline)
        full_signature=interactive_signature(candidate,True)
        ignored=git(candidate,'ls-files','--others','--ignored','--exclude-standard').splitlines()
        guard=(digest_control(ROOT)==controls and git(ROOT,'rev-parse','HEAD')==baseline
               and git(candidate,'rev-parse','HEAD')==baseline
               and allowed_changes(paths,task['allowed_paths'])
               and not ignored and 'SYMLINK' not in full_signature.values())
        if not guard: row['status']='blocked';row['reason']='protected path/control-plane guard';atomic_json(sp,state);print(tid,'BLOCKED guard');break
        if code!=0:
            row['status']='failed';row['reason']='worker timeout/error; candidate preserved, baseline unchanged'
            atomic_json(sp,state);print(tid,row['reason']);continue
        remaining=int(end-time.monotonic())
        if remaining<=0:
            row['status']='failed';row['reason']='budget before validation';atomic_json(sp,state);break
        before_gate=full_signature
        gate_log=receipt_log(runtime,row,'gate');atomic_json(sp,state)
        testcode=run_bounded(['node','--test',str(gate)],ROOT,gate_log,min(remaining,graph['turn_timeout_seconds']),
                            {**clean_environment(),'VEXA_CANDIDATE':str(candidate)})
        row['gate_exit']=testcode;seal_log(row,gate_log)
        if interactive_signature(candidate,True)!=before_gate:
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
        if row['status']=='verified': row['verified_signature']=before_gate
        if row['status']=='verified' and (git(candidate,'status','--porcelain') or interactive_signature(candidate,True)!=before_gate):
            row['status']='blocked';row['reason']='candidate changed after validation/commit'
        atomic_json(sp,state);print(tid,row['status'])
        if row['status']=='verified' and args.auto_accept and task.get('auto_accept',False):
            auto_args=argparse.Namespace(**vars(args));auto_args.action='accept';auto_args.task=tid
            execute(auto_args,graph,runtime,sp,state,end,remaining_budget,parser)
        else:
            # One reviewed change at a time: not a metric of finished software.
            if row['status'] in ('verified','blocked'): break
    print('State:',sp)

if __name__=='__main__':
    main()
