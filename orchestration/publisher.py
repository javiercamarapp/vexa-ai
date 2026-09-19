"""Publish real verified commits only; no empty commits, force pushes or date edits."""
import io
import json
from pathlib import Path
import re
import subprocess

REPO='javiercamarapp/vexa-ai'
TARGET='https://github.com/'+REPO+'.git'


def git(root,*args):
 return subprocess.check_output(['git','-C',str(root),*args],text=True,stderr=subprocess.STDOUT,timeout=30).strip()


def inspect_tree(root,commit):
 entries=subprocess.check_output(['git','-C',str(root),'ls-tree','-rz',commit],timeout=30).decode().split('\0')
 blobs=[]
 for entry in filter(None,entries):
  meta,name=entry.split('\t',1);mode,kind,oid=meta.split();parts=Path(name).parts
  if any(p in ('private','.runtime','credentials','.npmrc') or p.startswith('.env') for p in parts):
   raise ValueError('Private/sensitive path in publication tree: '+name)
  if kind!='blob' or mode not in ('100644','100755'):raise ValueError('Unexpected link/submodule in publication tree')
  blobs.append((oid,name))
 batch=subprocess.run(['git','-C',str(root),'cat-file','--batch'],input=('\n'.join(x[0] for x in blobs)+'\n').encode(),capture_output=True,check=True,timeout=30)
 stream=io.BytesIO(batch.stdout)
 for oid,name in blobs:
  header=stream.readline().split();size=int(header[2]);data=stream.read(size);stream.read(1)
  if header[0].decode()!=oid or header[1]!=b'blob':raise ValueError('Unexpected Git object')
  if re.search(rb'(sk-or-v1-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{30,}|GOCSPX-[a-zA-Z0-9_-]{20,})',data):
   raise ValueError('Potential secret in publication tree: '+name)


def publish_git(root,target,credential_helper=False):
 """Transport primitive also tested against a disposable local bare repository."""
 root=Path(root)
 if git(root,'status','--porcelain'):raise ValueError('Dirty source checkout')
 if git(root,'branch','--show-current')=='main':raise ValueError('Build must use its feature branch')
 head=git(root,'rev-parse','HEAD')
 # Include reachable history: deleting a secret later does not remove it from Git.
 for commit in git(root,'rev-list',head).splitlines():inspect_tree(root,commit)
 pub=root/'.runtime/publisher-main';pub.parent.mkdir(exist_ok=True)
 if not pub.exists():git(root,'worktree','add',str(pub),'main')
 if git(pub,'rev-parse','--show-toplevel')!=str(pub.resolve()):raise ValueError('Unexpected publisher worktree')
 if git(pub,'branch','--show-current')!='main' or git(pub,'status','--porcelain'):raise ValueError('Publisher checkout is not clean main')
 old=git(pub,'rev-parse','HEAD')
 # ff-only alone is insufficient: main ahead of the reviewed commit is a no-op.
 try:git(pub,'merge-base','--is-ancestor',old,head)
 except subprocess.CalledProcessError as exc:raise ValueError('Main contains commits outside the reviewed build history') from exc
 git(pub,'-c','core.hooksPath=/dev/null','merge','--ff-only',head)
 if git(pub,'rev-parse','HEAD')!=head:raise ValueError('Main differs from reviewed SHA before publication')
 args=['-c','core.hooksPath=/dev/null']
 if credential_helper:args+=['-c','credential.helper=','-c','credential.helper=!gh auth git-credential']
 # Pin the inspected object, not a mutable ref that could change after checking.
 git(pub,*args,'push',target,head+':refs/heads/main')
 remote=git(pub,*args,'ls-remote',target,'refs/heads/main').split()
 if not remote or remote[0]!=head:raise ValueError('Remote main SHA not verified')
 return {'sha':head,'previous_main':old,'new_commits':int(git(root,'rev-list','--count',old+'..'+head)),'remote_sha_verified':True}


def publish_vexa(root,allow_actions=False):
 data=json.loads(subprocess.check_output(['gh','repo','view',REPO,'--json','visibility'],text=True,timeout=20))
 if data.get('visibility')!='PRIVATE':raise ValueError('Dedicated VEXA repository must remain private')
 permission=json.loads(subprocess.check_output(['gh','api','repos/'+REPO+'/actions/permissions'],text=True,timeout=20))
 if permission.get('enabled') and not allow_actions:raise ValueError('Actions enabled without an approved execution budget')
 return publish_git(root,TARGET,credential_helper=True)
