"""Reproduce the vendored distribution from official pinned npm tarballs; no npm/scripts."""
import urllib.request,json,hashlib,base64,tarfile,io,pathlib,difflib,sys
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=False)
pins=[('saxes','6.0.0','1cdf52fbbe1ccbd175c365d2b8e63f46e590e74aff23fa6a44a6ec51522e96db'),('xmlchars','2.2.0','bdf900298963e4bd95b76aa95e96d29f05687e6ae662d617061778267b576da8')]
manifest=[]
for name,version,digest in pins:
 source=f'https://registry.npmjs.org/{name}/-/{name}-{version}.tgz'
 data=urllib.request.urlopen(source).read();assert hashlib.sha256(data).hexdigest()==digest
 files=[]
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:
  members=t.getmembers();seen=set()
  for m in members:
   p=pathlib.PurePosixPath(m.name)
   assert not p.is_absolute() and '..' not in p.parts and p.parts[0]=='package'
   assert '\\' not in m.name and not any(x in ('', '.', '..') for x in m.name.rstrip('/').split('/'))
   assert m.isfile() or m.isdir(), 'symlink or special entry'
   assert m.name not in seen;seen.add(m.name)
  for m in members:
   rel=pathlib.PurePosixPath(*pathlib.PurePosixPath(m.name).parts[1:]);dest=out/name/rel
   assert not dest.is_symlink()
   if m.isdir():dest.mkdir(parents=True,exist_ok=True);continue
   original=t.extractfile(m).read();final=original
   if name=='saxes' and str(rel)=='saxes.js':
    assert original.count(b'require("xmlchars/')==3
    final=original.replace(b'require("xmlchars/',b'require("../xmlchars/')
    patch=''.join(difflib.unified_diff(original.decode().splitlines(True),final.decode().splitlines(True),fromfile='saxes/saxes.js.upstream',tofile='saxes/saxes.js'))
    (out/'relative-imports.patch').write_text(patch)
   dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(final)
   files.append(dict(path=f'{name}/{rel}',original_sha256=hashlib.sha256(original).hexdigest(),final_sha256=hashlib.sha256(final).hexdigest()))
 manifest.append(dict(name=name,version=version,license='ISC' if name=='saxes' else 'MIT',source=source,sha256=digest,integrity='sha512-'+base64.b64encode(hashlib.sha512(data).digest()).decode(),files=files))
(out/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')

# npm's saxes tarball omits LICENSE; preserve the complete notice from its pinned gitHead.
license_source='https://raw.githubusercontent.com/lddubeau/saxes/211fa0ebec9b628affc09219199639887174bfc3/LICENSE'
license_digest='0fac2374380621b22e6b50451057721a9c52935b02d16d106a9f04897f061d0e'
notice=urllib.request.urlopen(license_source).read()
assert hashlib.sha256(notice).hexdigest()==license_digest
(out/'saxes/LICENSE').write_bytes(notice)
(out/'license-provenance.json').write_text(json.dumps(dict(source=license_source,sha256=license_digest),indent=2)+'\n')
