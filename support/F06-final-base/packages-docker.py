#!/usr/bin/env python3
"""Transparent CLI forwarding; only the four reviewed schema runs gain ownership flags."""
import json, os, pathlib, re, sys

def prepare(args, directory, broker):
    if not args or args[0] != 'run': return args
    # Exact original run contract: no arbitrary image, network, or caller-owned target.
    if len(args)!=11 or args[:5]!=['run','--pull','never','--network','none'] or args[5]!='--name' or args[7:]!=['-d','-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.159']:
        raise ValueError('SCHEMA_RUN_CONTRACT')
    name=args[6]
    if not re.fullmatch(r'vexa-schema-(syn|review)-[a-f0-9-]{36}',name):raise ValueError('SCHEMA_NAME')
    cid=directory/(name+'.cid')
    # Reservation survives a killed client before Docker returns its ID.
    fd=os.open(directory/'resources.jsonl',os.O_WRONLY|os.O_APPEND|os.O_NOFOLLOW)
    try:
        os.write(fd,(json.dumps({'name':name,'cidfile':cid.name,'broker':broker})+'\n').encode());os.fsync(fd)
    finally:os.close(fd)
    return ['run','--cidfile',str(cid),'--label','rovaq.packages.broker='+broker,*args[1:]]

def main():
    args=prepare(sys.argv[1:],pathlib.Path(os.environ['ROVAQ_PACKAGES_ARTIFACTS']),os.environ['ROVAQ_PACKAGES_BROKER'])
    os.execv(os.environ['ROVAQ_PACKAGES_DOCKER'],['docker',*args])
if __name__=='__main__':main()
