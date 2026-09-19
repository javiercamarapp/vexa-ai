#!/usr/bin/env python3
"""Serial, bounded LOCAL construction. Separate gate author, worker and reviews.
This is a cooperative-agent workflow, not a sandbox for hostile code. Cloud
provisioning, customer data and paid inference are not authorized. Explicitly
approved publication to the dedicated private GitHub repository is separate.
"""
import argparse
import contextlib
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('vexa_runner', Path(__file__).with_name('runner.py'))
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)


def select_task(graph, states, allowed, blocked):
    for t in graph['tasks']:
        row = states.get(t['id'], {})
        if t['id'] not in allowed or t['id'] in blocked: continue
        if row.get('status', 'pending') not in ('pending', 'failed'): continue
        if row.get('attempts', 0) >= graph['max_attempts_per_task']: continue
        if all(states.get(d, {}).get('status') == 'accepted' for d in t['depends_on']): return t
    return None


def approved_review(data, task, stage):
    if not isinstance(data, dict): return False
    if data.get('approved') is not True or data.get('task_id') != task or data.get('stage') != stage: return False
    findings = data.get('findings')
    if not isinstance(findings, list): return False
    return all(isinstance(f, dict) and f.get('severity') == 'P3' for f in findings)


SCHEMA = {'type':'object','additionalProperties':False,'required':['approved','task_id','stage','findings','evidence'],
 'properties':{'approved':{'type':'boolean'},'task_id':{'type':'string'},'stage':{'type':'string'},
 'evidence':{'type':'string'},'findings':{'type':'array','items':{'type':'object','additionalProperties':False,
 'required':['severity','location','reason'],'properties':{'severity':{'type':'string','enum':['P0','P1','P2','P3']},
 'location':{'type':'string'},'reason':{'type':'string'}}}}}}


class StopLoop(RuntimeError): pass


class Loop:
    def __init__(self, root, policy):
        self.root = Path(root); self.policy = policy
        self.rt = self.root/'.runtime'; self.file = self.rt/'autoloop-state.json'
        self.end = None; self.s = None

    def save(self): r.atomic_json(self.file, self.s)
    def event(self, kind, **details):
        with (self.rt/'autoloop-events.jsonl').open('a') as f:
            f.write(json.dumps({'time':time.time(),'run_id':self.s['run_id'],'event':kind,**details})+'\n')
    def check(self):
        if (self.rt/'STOP').exists(): raise StopLoop('operator_STOP')
        if time.monotonic() >= self.end: raise StopLoop('time_budget')
    def remaining(self, maximum):
        self.check(); return min(maximum, max(.01, self.end-time.monotonic()))
    def head(self): return r.git(self.root,'rev-parse','HEAD')
    def states(self):
        p=self.rt/'state.json'; return json.loads(p.read_text()) if p.exists() else {}
    def root_snapshot(self):
        if r.git(self.root,'status','--porcelain'): raise StopLoop('dirty_controller_checkout')
        return self.head(), r.interactive_signature(self.root)
    def check_root(self, snapshot):
        if self.root_snapshot()!=snapshot: raise StopLoop('controller_changed_outside_supervisor')
    def log(self, label): return self.rt/f'auto-{self.s["run_id"]}-{time.time_ns()}-{label}'
    def command(self, argv, cwd, label, seconds=300, env=None):
        p=self.log(label+'.log')
        code=r.run_bounded(argv,cwd,p,self.remaining(seconds),env or r.clean_environment())
        self.event('command',argv=argv,exit=code,log=p.name)
        return code,p
    def runner(self, action, tid, note=None):
        self.check(); return self.execute_runner(action,tid,note)
    def execute_runner(self, action, tid, note=None):
        # run() owns the SAME lock as runner.main; execute in-process, never bypass
        # a competing owner or recursively acquire our own flock via another CLI.
        args=argparse.Namespace(action=action,task=tid,approval_note=note,max_rounds=1,max_minutes=5,auto_accept=False)
        end=min(self.end,time.monotonic()+300)
        def remaining():
            left=end-time.monotonic()
            if left<=0:raise SystemExit('Time budget reached')
            return left
        log=self.log('runner-'+action+'.log');old_root=r.ROOT
        try:
            r.ROOT=self.root
            with log.open('w') as f,contextlib.redirect_stdout(f),contextlib.redirect_stderr(f):
                r.execute(args,self.graph,self.rt,self.rt/'state.json',self.states(),end,remaining,argparse.ArgumentParser())
        except SystemExit as exc:
            self.event('runner',action=action,task=tid,exit=str(exc),log=log.name)
            raise RuntimeError(f'runner {action} failed: {exc}; {log.name}')
        finally:r.ROOT=old_root
        self.event('runner',action=action,task=tid,exit=0,log=log.name)
    def model(self, stage, cwd, prompt, output=None):
        self.check()
        if self.s['model_calls']>=self.policy['max_model_calls']: raise StopLoop('model_call_budget')
        try:
            auth=subprocess.run(['codex','login','status'],capture_output=True,text=True,env=r.clean_environment(),timeout=self.remaining(15),stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired:raise StopLoop('subscription_auth_timeout')
        if auth.returncode or 'Logged in using ChatGPT' not in auth.stdout+auth.stderr:
            raise StopLoop('ChatGPT_subscription_auth_required; no_API_key_fallback')
        self.s['model_calls']+=1; self.s['stage']=stage; self.save()
        argv=['codex','exec','--ignore-user-config','--model','gpt-6-astra','--sandbox','workspace-write',
              '-c','sandbox_workspace_write.network_access=true','--add-dir',str(Path.home()/'.npm'),
              '--color','never','-C',str(cwd)]
        if output:
            schema=self.rt/'autoloop-review-schema.json'; r.atomic_json(schema,SCHEMA)
            argv+=['--output-schema',str(schema),'--output-last-message',str(output)]
        # Prompts are not persisted in the public event log.
        p=self.log(stage+'.log')
        code=r.run_bounded(argv+[prompt],cwd,p,self.remaining(900),r.clean_environment())
        self.event('model',stage=stage,exit=code,log=p.name)
        if code: raise StopLoop(f'{stage} exited {code}; inspect {p.name}; no quota/provider fallback')
        return p
    def rules(self, tid):
        return f'''Trabaja sólo {tid}. Lee su ficha y contratos en construccion/; no re-investigar negocio.
Privados/credenciales/otros proyectos prohibidos. Sólo datos sintéticos. NO cloud, push, deploy, compras,
Google real, CRM real ni API de inferencia. Para desarrollar usa Codex ChatGPT. Red sólo npm registry,
documentación oficial pública y localhost VEXA. Nunca consultar DB/servicios de otros proyectos.
Supabase local VEXA debe usar project_id vexa-local y puertos56321..56329; NO54321 ni55321 (otros proyectos).
No tocar orchestration, PROGRAMA, grafo, Git/config/hooks ni recibos. No commit. No delegar agentes.
Candidato libre de node_modules/.next/archivos ignorados: instalar/build/test en copias temporales propias,
con cache ~/.npm y npm --ignore-scripts. No alterar tests congelados. API faltante no se simula como real.
Máximo15min; reportar bloqueos sin falsificar resultados y limpiar sólo procesos/temporales propios.
'''
    def review(self, tid, stage, candidate, context):
        before=r.interactive_signature(candidate,True); snap=self.root_snapshot(); out=self.log('review.json')
        prompt=self.rules(tid)+f'''Eres revisor independiente con contexto limpio, NO escritor.
Revisa {stage}: {context}. Nada de cambios al código, pruebas ni archivos de este worktree.
Comprueba requisitos/efectos, negativos, dinero y tenancy según ficha. Puedes ejecutar en temporales propios.
Un test que verifica sólo un JSON passed, un skip o un import simulado NO acredita un componente real.
Errores de setup no son evidencia de regresión. En stage gate, evalúa la señal del baseline, y exige oráculos
observables, no aserciones tautológicas ni pruebas diseñadas para complacer al futuro candidato.
No P0/P1/P2 para approved=true. Devuelve JSON task_id={tid}, stage={stage}, evidencia real y hallazgos.
'''
        self.model('review-'+stage,candidate,prompt,out); self.check_root(snap)
        if r.interactive_signature(candidate,True)!=before: raise StopLoop('reviewer_modified_candidate')
        data=json.loads(out.read_text()); self.event('review',task=tid,stage=stage,report=out.name,approved=approved_review(data,tid,stage))
        return approved_review(data,tid,stage),out
    def guard(self, candidate, baseline, allowed):
        paths=r.changed_paths(candidate,baseline)
        ignored=r.git(candidate,'ls-files','--others','--ignored','--exclude-standard').splitlines()
        if (ignored or 'SYMLINK' in r.interactive_signature(candidate,True).values()
                or not r.allowed_changes(paths,allowed) or r.git(candidate,'rev-parse','HEAD')!=baseline):
            raise StopLoop('candidate_path_or_HEAD_guard')
        for p in paths:
            f=candidate/p
            if any(x.startswith('.env') or x in ('private','credentials','.npmrc') for x in Path(p).parts):
                raise StopLoop('sensitive_path_guard')
            if f.is_file() and re.search(rb'(sk-or-v1-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{30,}|GOCSPX-[a-zA-Z0-9_-]{20,})',f.read_bytes()):
                raise StopLoop('potential_secret_guard')
        return paths
    def gate(self, task):
        gate=self.root/task['acceptance']
        if gate.is_file(): return
        tid=task['id']; snap=self.root_snapshot(); candidate=self.log('gate-worktree')
        r.git(self.root,'worktree','add','--detach',str(candidate),snap[0])
        allowed=[task['acceptance'],f'tests/acceptance/support/{tid}/']
        prompt=self.rules(tid)+f'''Eres autor de examen, no implementador del producto.
Crear únicamente {allowed}. Implementación del producto PROHIBIDA. El gate carga VEXA_CANDIDATE.
Escribe los oráculos adversarios concretos de la ficha, con aserciones observables sobre implementación real.
Usa soporte por tarea sólo si es necesario. No modificar fixtures/gold existentes ni otros gates.
Si infraestructura de ensayo falta, falla cerrado y explica cómo habilitarla; nunca tests vacíos/skip/echo.
'''
        self.model('gate-author',candidate,prompt); self.check_root(snap)
        paths=self.guard(candidate,snap[0],allowed)
        if not (candidate/task['acceptance']).is_file(): raise RuntimeError('author did not create gate')
        code,log=self.command(['node','--test',str(candidate/task['acceptance'])],self.root,'gate-baseline',env={**r.clean_environment(),'VEXA_CANDIDATE':str(self.root)})
        if code not in (0,1): raise RuntimeError(f'gate baseline setup/timeout exit={code}')
        ok,report=self.review(tid,'gate',candidate,f'Gate propuesto; baseline exit={code}; log {log}. Ficha {tid}.')
        if not ok: raise RuntimeError(f'gate review rejected: {report.name}')
        self.guard(candidate,snap[0],allowed); self.check_root(snap)
        if not paths: raise RuntimeError('empty gate proposal')
        r.git(candidate,'-c','core.hooksPath=/dev/null','add','--',*paths)
        r.git(candidate,'-c','core.hooksPath=/dev/null','commit','-m',f'test({tid}): examen externo revisado')
        # Only the reviewed control-plane delta is integrated, never product code here.
        r.git(self.root,'-c','core.hooksPath=/dev/null','merge','--ff-only',r.git(candidate,'rev-parse','HEAD'))
        register=self.root/'docs/blueprint/gate-register.json'
        if register.is_file():
            data=json.loads(register.read_text()); byid={t['id']:t for t in self.graph['tasks']}
            for row in data['tasks']:row['state']='authored' if (self.root/byid[row['id']]['acceptance']).is_file() else 'missing'
            r.atomic_json(register,data)
            r.git(self.root,'add','--','docs/blueprint/gate-register.json')
            if r.git(self.root,'diff','--cached','--name-only'):
                r.git(self.root,'-c','core.hooksPath=/dev/null','commit','-m',f'chore({tid}): registrar presencia del gate, no PASS')
        self.event('gate_integrated',task=tid,review=report.name,commit=self.head())
    def reject(self, tid, report):
        stop=self.rt/'STOP'; token=f'autoloop {self.s["run_id"]} {time.time_ns()}'.encode()
        with stop.open('xb') as f:f.write(token)
        stamp=stop.stat().st_mtime_ns
        try:self.runner_without_stop_check('reject',tid,f'Usuario autorizó construcción local automática; revisión {report.name} rechazó; corrección dentro del techo de dos intentos.')
        finally:
            if stop.exists() and stop.read_bytes()==token and stop.stat().st_mtime_ns==stamp:stop.unlink()
    def runner_without_stop_check(self, action, tid, note):
        # Only this explicit rejection may run while OUR STOP is installed.
        if time.monotonic()>=self.end:raise StopLoop('time_budget_before_rejection')
        self.execute_runner(action,tid,note)
    def task(self, task):
        tid=task['id']; self.gate(task); self.check()
        snap=self.root_snapshot(); self.runner('prepare',tid)
        candidate=Path(self.states()[tid]['worktree'])
        prompt=self.rules(tid)+f'''Eres constructor. Allowlist exacta: {task['allowed_paths']}.
Implementa sólo {task.get('objective',tid)}. Examen congelado: {self.root/task['acceptance']}.
Puedes leer el examen pero NO modificarlo. No cambiar control-plane ni baseline. Conservar código previo.
Ejecutar prueba desde controlador con VEXA_CANDIDATE={candidate}; usar copias temporales para builds.
Fallo anterior en esta corrida, si existe: {self.s.get('last_failure')}. Conserva su evidencia; no lo repitas ciegamente.
Devuelve archivos, comandos/salidas y bloqueos reales, sin afirmar completado por tu propia respuesta.
'''
        self.model('worker',candidate,prompt); self.check_root(snap); self.guard(candidate,snap[0],task['allowed_paths'])
        self.runner('verify',tid,'Encargo explícito del usuario de construcción automática LOCAL con fixtures; no autorización de cloud/datos/pagos.')
        ok,report=self.review(tid,'implementation',candidate,f'Comparar baseline {snap[0]} con commit {self.states()[tid]["commit"]}. Gate externo ya ejecutado; revisar adecuación y regresiones.')
        if not ok:
            self.reject(tid,report); return False
        # Replay EVERY previously accepted gate against the new candidate, not baseline.
        states=self.states()
        previous=[str(self.root/t['acceptance']) for t in self.graph['tasks'] if states.get(t['id'],{}).get('status')=='accepted']
        if previous:
            code,log=self.command(['node','--test','--test-concurrency=1',*previous],self.root,'accepted-regressions',seconds=600,env={**r.clean_environment(),'VEXA_CANDIDATE':str(candidate)})
            if code:
                if code!=1:raise StopLoop(f'regression infrastructure/timeout: {log.name}')
                self.s['last_failure']={'task':tid,'reason':'previous contract regressed','log':str(log)}
                self.reject(tid,log);return False
        code,log=self.command([sys.executable,'-W','error::ResourceWarning','-m','unittest','discover','-s','tests/controller'],self.root,'controller-regression',seconds=180)
        if code:raise StopLoop(f'controller regression: {log.name}')
        self.check_root(snap);self.check();self.runner('accept',tid)
        self.event('accepted',task=tid,commit=self.head(),review=report.name)
        if self.policy.get('publish_github'):
            self.check()
            ps=importlib.util.spec_from_file_location('vexa_publisher',Path(__file__).with_name('publisher.py'))
            publisher=importlib.util.module_from_spec(ps);ps.loader.exec_module(publisher)
            try:
                result=publisher.publish_vexa(self.root,allow_actions=self.policy.get('allow_actions_execution',False))
                self.event('published',task=tid,**result);self.s['last_published']=result
            except Exception as exc:raise StopLoop('github_publication_requires_review: '+str(exc))
        return True
    def authorize_retry(self, tid, note):
        if not note or not note.strip():raise StopLoop('explicit_review_note_required')
        if tid not in self.policy['local_task_ids']:raise StopLoop('task_not_in_local_policy')
        if not self.rt.exists():raise StopLoop('no_previous_run')
        with (self.rt/'autoloop.lock').open('a+') as lock,(self.rt/'lock').open('a+') as controller_lock:
            try:
                fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);fcntl.flock(controller_lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:raise StopLoop('another_controller_running')
            if not (self.rt/'STOP').exists():raise StopLoop('STOP_required_for_budget_renewal')
            self.root_snapshot()
            if self.states().get(tid,{}).get('status','pending')!='pending':raise StopLoop('runner_recovery_to_pending_required_first')
            old=json.loads(self.file.read_text())
            if tid not in old.get('attempts',{}):raise StopLoop('no_previous_attempt')
            r.atomic_json(self.rt/f'auto-before-renewal-{time.time_ns()}.json',old)
            old.setdefault('budget_renewals',[]).append({'task':tid,'note':note.strip(),'time':time.time(),'previous_attempts':old['attempts'][tid],'previous_block':old.get('blocked',{}).get(tid)})
            old['attempts'][tid]=0;old.setdefault('blocked',{}).pop(tid,None);old['status']='stopped';old['reason']='explicit_operator_budget_renewal'
            r.atomic_json(self.file,old)
            return 'Budget renewed for this local task; STOP retained; no candidate accepted.'
    def run(self):
        self.rt.mkdir(exist_ok=True)
        with (self.rt/'autoloop.lock').open('a+') as lock, (self.rt/'lock').open('a+') as controller_lock:
            try:
                fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
                fcntl.flock(controller_lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:raise StopLoop('another_controller_running')
            self.root_snapshot(); self.graph=r.load_graph(self.root/'orchestration/graph.json')
            modes={x['id']:x['mode'] for x in json.loads((self.root/'construccion/catalogo.json').read_text())}
            allowed=set(self.policy['local_task_ids'])
            if any(modes.get(x) not in ('worker','interactive','control') for x in allowed):raise StopLoop('external_or_unknown_task_in_policy')
            old=json.loads(self.file.read_text()) if self.file.exists() else {}
            if old.get('status')=='running':raise StopLoop('interrupted_run_requires_operator_review')
            if any(x.get('status') in ('prepared','running','verified') for x in self.states().values()):raise StopLoop('existing_candidate_requires_operator_review')
            self.end=time.monotonic()+self.policy['max_minutes']*60
            if old:r.atomic_json(self.rt/f'auto-archived-{time.time_ns()}.json',old)
            self.s={'run_id':str(time.time_ns()),'pid':os.getpid(),'status':'running','model_calls':0,'cycles':0,
                    'attempts':old.get('attempts',{}),'blocked':old.get('blocked',{}),'budget_renewals':old.get('budget_renewals',[]),
                    'started_at':time.time(),'initial_head':self.head()}
            self.save(); self.event('started',policy=self.policy)
            try:
                while self.s['cycles']<self.policy['max_cycles']:
                    self.check(); t=select_task(self.graph,self.states(),allowed,self.s['blocked'])
                    if t is None:raise StopLoop('no_eligible_local_task; inspect external dependencies and receipts')
                    tid=t['id']; n=self.s['attempts'].get(tid,0)
                    if n>=2:self.s['blocked'][tid]='two_attempts_exhausted';self.save();continue
                    self.s['task']=tid;self.s['attempts'][tid]=n+1;self.s['cycles']+=1;self.save()
                    try:
                        if not self.task(t) and n+1>=2:self.s['blocked'][tid]='review_rejected_twice'
                    except StopLoop:raise
                    except Exception as e:
                        row=self.states().get(tid,{})
                        if row.get('status')=='failed' and n+1<2:
                            self.event('retryable_failure',task=tid,reason=str(e))
                            self.s['last_failure']={'task':tid,'reason':str(e),'worktree':row.get('worktree')}
                        else:
                            self.s['blocked'][tid]=str(e);self.event('blocked',task=tid,reason=str(e))
                            if row.get('status') in ('prepared','running','verified'):
                                raise StopLoop('candidate_requires_operator_review: '+str(e))
                    self.save()
                raise StopLoop('cycle_budget')
            except (StopLoop,KeyboardInterrupt) as e:
                self.s['status']='stopped';self.s['reason']=str(e) or 'interrupt';self.s['ended_at']=time.time();self.s['final_head']=self.head();self.save()
                self.event('stopped',reason=self.s['reason'])
            return self.s


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['run','status','retry']);p.add_argument('--policy',default='orchestration/auto-policy.json');p.add_argument('--task');p.add_argument('--approval-note');args=p.parse_args()
    if args.action=='status':
        state=ROOT/'.runtime/autoloop-state.json';print(state.read_text() if state.exists() else 'No automatic run receipt.');return
    policy=json.loads((ROOT/args.policy).read_text())
    if not (1<=policy['max_minutes']<=240 and 1<=policy['max_cycles']<=55 and 1<=policy['max_model_calls']<=220):p.error('Budget exceeds approved ceiling')
    try:
        loop=Loop(ROOT,policy)
        if args.action=='retry':print(loop.authorize_retry(args.task,args.approval_note));return
        print(json.dumps(loop.run(),indent=2));raise SystemExit(2)
    except StopLoop as e:raise SystemExit(str(e))

if __name__=='__main__':main()
