"""Scratch paths allocated by the launcher, never accepted from child manifests."""
import os,stat,tempfile,shutil
from pathlib import Path

class Scratch:
    def __init__(self):
        self.paths={}
        self.identities={}
    def allocate(self,name,prefix):
        if name in self.paths:raise ValueError('Duplicate scratch allocation')
        p=Path(tempfile.mkdtemp(prefix=prefix,dir='/tmp'))
        s=p.lstat();self.paths[name]=p;self.identities[name]=(s.st_dev,s.st_ino)
        return p
    def cleanup(self):
        failures=[]
        for name,p in self.paths.items():
            try:
                s=p.lstat()
                if not stat.S_ISDIR(s.st_mode) or (s.st_dev,s.st_ino)!=self.identities[name]:
                    failures.append(name+': ownership changed');continue
                shutil.rmtree(p)
            except FileNotFoundError:pass
            except OSError:failures.append(name+': cleanup failed')
        absent=all(not os.path.lexists(p) for p in self.paths.values())
        return {'scratch_absent':absent,'scratch_errors':failures,'verified':absent and not failures}
