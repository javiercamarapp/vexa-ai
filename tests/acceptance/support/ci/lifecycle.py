"""Launcher-owned process groups and durable Docker ownership journal."""
import json, os, pathlib, re, signal, subprocess, time, uuid

class Lifecycle:
    def __init__(self, artifacts):
        self.broker=str(uuid.uuid4()); self.journal=pathlib.Path(artifacts)/('resources-'+self.broker+'.jsonl')
        fd=os.open(self.journal,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
        self.cancelled=0; self.previous={}
    def install(self):
        def cancel(sig, frame):
            if not self.cancelled: self.cancelled=sig
        for sig in (signal.SIGINT,signal.SIGTERM):
            self.previous[sig]=signal.signal(sig,cancel)
    def restore(self):
        for sig,handler in self.previous.items():signal.signal(sig,handler)
    def environment(self, env):
        return dict(env,VEXA_CI_JOURNAL=str(self.journal),VEXA_CI_BROKER=self.broker)
    @staticmethod
    def stop(child):
        # The leader may have exited while descendants still hold pipes or sockets.
        def send(sig):
            try:os.killpg(child.pid,sig);return True
            except ProcessLookupError:return False
            except PermissionError:
                # macOS sandbox can report EPERM for a zombie-only group. Reap
                # the leader and retry the actual signal; only ESRCH is absence.
                child.poll()
                try:os.killpg(child.pid,sig);return True
                except ProcessLookupError:return False
        if send(signal.SIGTERM):
            # Do not reap the leader during grace: keep group ownership stable
            # until KILL, including when TERM exits the leader before descendants.
            time.sleep(2)
            send(signal.SIGKILL)
        try:return child.communicate(timeout=5)[0] or ''
        except subprocess.TimeoutExpired:
            child.stdout.close();child.wait(timeout=5);return ''
    def cleanup(self):
        result={'journal':str(self.journal),'broker':self.broker,'verified':False,'resources':[]}
        try:
            if self.journal.is_symlink() or self.journal.stat().st_mode&0o777!=0o600:raise ValueError('JOURNAL_MODE')
            entries=[json.loads(line) for line in self.journal.read_text().splitlines()]
            for e in entries:
                if set(e)!={'kind','name','broker'} or e['kind'] not in ('container','network') or e['broker']!=self.broker or not re.fullmatch(r'vexa-f01-0[234]-[0-9a-f-]{36}(?:-[a-z]+)?',e['name']):raise ValueError('JOURNAL_INVALID')
            def docker(args):return subprocess.run(['docker',*args],capture_output=True,text=True,timeout=15)
            def inspect(e):
                labels='.Labels' if e['kind']=='network' else '.Config.Labels'
                r=docker([e['kind'],'inspect',e['name'],'--format','{{.Id}}|{{.Name}}|{{ index '+labels+' "vexa.ci.broker" }}'])
                if r.returncode:
                    if re.search(r'No such (object|container|network)',r.stderr,re.I) or r.stderr.strip()=='Error response from daemon: network '+e['name']+' not found':return None
                    raise ValueError('DOCKER_INSPECT_FAILED')
                rid,name,owner=r.stdout.strip().split('|')
                if not re.fullmatch('[a-f0-9]{64}',rid) or name.lstrip('/')!=e['name'] or owner!=self.broker:raise ValueError('OWNERSHIP_MISMATCH')
                return rid
            # Validate the whole journal first, then containers before networks.
            unique={(e['kind'],e['name']):e for e in entries}
            for e in sorted(unique.values(),key=lambda e:e['kind']):
                item=dict(e);result['resources'].append(item)
                try:
                    rid=inspect(e);item['id']=rid
                    if rid:
                        r=docker(['network','rm',rid] if e['kind']=='network' else ['container','rm','-f','-v',rid])
                        if r.returncode:raise ValueError('DOCKER_REMOVE_FAILED')
                        if inspect(e) is not None:raise ValueError('RESOURCE_REMAINS')
                    item['absent']=True
                except Exception as ex:item['error']=type(ex).__name__+':'+str(ex) if isinstance(ex,ValueError) else type(ex).__name__
            result['verified']=all(e.get('absent') for e in result['resources'])
        except Exception as ex:result['error']=str(ex) if isinstance(ex,ValueError) else type(ex).__name__
        return result
