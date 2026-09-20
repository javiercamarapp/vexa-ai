# Vendored XML dependencies

Runtime: saxes 6.0.0 (ISC), xmlchars 2.2.0 (MIT), official npm tarballs.
Complete upstream distribution files retained, including readable JS, declarations,
source maps, READMEs and package manifests. No install/build/lifecycle scripts run.
No npm CLI, npm configuration or credentials are read; downloads use Python stdlib
HTTPS against fixed public URLs. No node_modules or lockfile is needed.

`provenance.json` pins versions, official sources, tarball SHA256/SRI and original
and final SHA256 of every distribution file. `relative-imports.patch` changes only
three saxes CommonJS require specifiers to the sibling xmlchars directory. No
upstream parser logic is modified. Upstream package.json defines the CJS scope.

The npm saxes tarball omits LICENSE. `saxes/LICENSE` preserves the complete ISC
and historical notices from the exact gitHead published in npm metadata;
`license-provenance.json` pins its official upstream URL and digest. xmlchars'
MIT license is included byte-for-byte from npm.

Reproduce into a NEW temporary directory (network required):

```sh
python3 -B packages/ingestion/vendor/repack.py /tmp/vexa-xml-vendor-reproduction
```

This verifies pinned tarball digests, rejects absolute/traversal/duplicate paths,
links and special members before extracting any member, copies distribution
files and applies the recorded three-specifier substitution. Compare resulting
files with this directory (repack.py and this README are local packaging tools).
Do not execute the upstream package.json scripts.
