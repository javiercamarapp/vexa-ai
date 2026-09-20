#!/usr/bin/env python3
"""Explicit future disposable runner only. Never invoked automatically by local gate."""
import argparse, os, pathlib, shutil, subprocess, tempfile
from run import CONTROL, environment
p=argparse.ArgumentParser();p.add_argument('--candidate',type=pathlib.Path,required=True);p.add_argument('--authorized-disposable-runner',action='store_true');a=p.parse_args()
if not (a.authorized_disposable_runner and os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted' and os.environ.get('GITHUB_REF')=='refs/heads/main'):
    p.error('bootstrap requires separately authorized future GitHub-hosted main runner')
# No cache fallback in gates. Bootstrap primes the same HOME npm cache in disposable copies.
for source,dirs in [(a.candidate,('package.json','package-lock.json','apps','packages')),(CONTROL/'tests/acceptance/support/F01-02',('package.json','package-lock.json'))]:
    with tempfile.TemporaryDirectory(prefix='vexa-ci-bootstrap-') as temp:
        dest=pathlib.Path(temp)
        for rel in dirs:
            src=source/rel
            if src.is_dir(): shutil.copytree(src,dest/rel,ignore=shutil.ignore_patterns('.git','.next','node_modules','.env*'))
            else: shutil.copy2(src,dest/rel)
        subprocess.run(['npm','ci','--ignore-scripts','--no-audit','--no-fund'],cwd=dest,env=environment(dest,a.candidate),check=True)
# Pull is bootstrap-only, pinned ARM digests audited in PORTABILITY. Never run locally.
for image,digest in [('public.ecr.aws/supabase/postgres:17.6.1.159','86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f'),('public.ecr.aws/supabase/gotrue:v2.195.0','362659ca70eaa75ba05bbaf963caa84c1c5afe5e8fbf0777e17b830dd5f0f60a'),('public.ecr.aws/supabase/storage-api:v1.69.11','97ed68d33417d253a45fe0a70f84324d92250a3e239bf18aa6cf87269dbf6727'),('public.ecr.aws/supabase/postgrest:v16.1','5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d'),('public.ecr.aws/supabase/mailpit','37a38e48e9338cd7e89dfeb487f37b02ebfcd9cb23111bed2d345e79d37d6dd6'),('mcp/playwright','8771dc4666e7c11440bfc6a0c6b00480e9a15b8891b45f29a52d7d995f8d1492')]:
    ref=image.split(':')[0]+'@sha256:'+digest
    subprocess.run(['docker','pull','--platform','linux/arm64',ref],check=True)
    subprocess.run(['docker','tag',ref,image],check=True)
