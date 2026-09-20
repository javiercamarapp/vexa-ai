"""Hash frozen executable gate and product inputs, excluding receipts/build outputs."""
from pathlib import Path
import hashlib,json,sys,os
b=Path(__file__).resolve().parent;root=b.parents[3];product=Path(os.environ['VEXA_CANDIDATE'])
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def sources():
 gate={str(p.relative_to(root)):digest(p) for p in b.iterdir() if p.suffix in ['.mjs','.py']}
 gate['tests/acceptance/F02-02.test.mjs']=digest(root/'tests/acceptance/F02-02.test.mjs')
 prod={str(p.relative_to(product)):digest(p) for scope in ['apps','packages','supabase'] for p in (product/scope).rglob('*') if p.is_file() and not any(x in p.parts for x in ['node_modules','.next','.git','evidence','__pycache__'])}
 for f in ['package.json','package-lock.json']:prod[f]=digest(product/f)
 return dict(gate=gate,product=prod)
p=b/'FINAL-SOURCE-BEFORE.json';now=sources()
if sys.argv[1]=='before':
 assert not p.exists(),'Do not overwrite frozen before snapshot'
 p.write_text(json.dumps(now,indent=2))
else:
 (b/'FINAL-SOURCE-AFTER.json').write_text(json.dumps(now,indent=2));assert now==json.loads(p.read_text()),'SOURCE_HASH_MISMATCH';print('GATE_AND_PRODUCT_SOURCES_UNCHANGED',len(now['gate']),len(now['product']))
