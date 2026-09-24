import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { NextConfig } from "next";

// Public build identity only. Next inlines this value into the compiled route;
// changing a runtime environment variable does not relabel an existing build.
const revision = process.env.VEXA_BUILD_REVISION ?? "";
if (revision !== "" && !/^[0-9a-f]{40}$/.test(revision)) {
  throw new Error("VEXA_BUILD_REVISION must be a complete lowercase Git SHA");
}
// Bind candidate eligibility to the actual source compiled into this artifact.
// This public fingerprint is derived here; never read it from deployment env.
const extractionPaths = ['packages/gateway/index.mjs','packages/gateway/budget.mjs','packages/gateway/catalog.mjs','packages/intelligence/index.mjs'];
const extractionCode = Object.fromEntries(extractionPaths.map(name => {
  const file = resolve(__dirname, '../..', name), stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('CANDIDATE_RUNTIME_SOURCE_INVALID');
  return [name, createHash('sha256').update(readFileSync(file)).digest('hex')];
}));
const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { VEXA_COMPILED_REVISION: revision, VEXA_COMPILED_EXTRACTION_CODE: JSON.stringify(extractionCode) },
};

export default nextConfig;
