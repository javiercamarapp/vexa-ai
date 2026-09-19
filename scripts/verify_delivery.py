"""Verify local source preservation and dossier integrity, not SaaS readiness."""
import hashlib
import json
from pathlib import Path
import re
import sys

root=Path(__file__).resolve().parents[1]
errors=[]
manifest=root/'private/manifest.json'
if manifest.exists():
 rows=json.loads(manifest.read_text());audio=0;seconds=0
 for row in rows:
  p=root/'private/originals'/row['name']
  if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=row['sha256']:
   errors.append('source hash mismatch: '+row['name'])
  if row['name'].endswith('.m4a'):
   audio+=1;seconds+=row['duration_seconds']
   for folder in ['transcripts','transcripts-contextual']:
    for ext in ['txt','srt','json']:
     out=root/'private'/folder/(Path(row['name']).stem+'.'+ext)
     if not out.is_file() or not out.stat().st_size: errors.append('missing transcript: '+str(out))
 if audio!=6:errors.append('expected six audio files')
 print(f'Originals: {len(rows)}; audios: {audio}; measured duration: {seconds:.6f}s; two-pass outputs expected: {audio*6}')
else: print('Private sources absent: NOT VERIFIED (normal on a public clone)')
files=[root/'README.md',root/'AGENTS.md']+[p for p in (root/'docs').rglob('*.md') if 'fuentes' not in p.parts]
links=0
for f in files:
 for match in re.finditer(r'\[[^\]]*\]\(([^)]+)\)',f.read_text()):
  link=match.group(1).split('#')[0]
  if not link or '://' in link or link.startswith('mailto:'):continue
  links+=1
  if not (f.parent/link).exists():errors.append('broken link: '+str(f.relative_to(root))+' -> '+link)
graph=json.loads((root/'orchestration/graph.json').read_text());present=0
for task in graph['tasks']:
 if not (root/task['prompt']).is_file():errors.append('missing prompt: '+task['id'])
 present+=int((root/task['acceptance']).is_file())
print(f'Authored dossiers checked: {len(files)}; local links checked: {links}')
print(f'Graph tasks: {len(graph["tasks"])}; acceptance present: {present}; missing/blocked: {len(graph["tasks"])-present}')
if errors:
 print('\n'.join(errors));sys.exit(1)
print('Integrity checks passed. This is NOT a product, semantic transcript, legal or deployment verification.')
