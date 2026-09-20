"""SYNTHETIC F02-02 build in fresh TMP; no personal npm config or install scripts."""
import pathlib,tempfile,shutil,subprocess,os,json,time
root=pathlib.Path(__file__).resolve().parents[3]
evidence=root/'packages/jobs/test/evidence';evidence.mkdir(exist_ok=True)
tag=str(time.time_ns());tmp=pathlib.Path(tempfile.mkdtemp(prefix='vexa-f0202-product-'))
for name in ['apps','packages','supabase']:
 shutil.copytree(root/name,tmp/name,ignore=shutil.ignore_patterns('node_modules','.next','evidence','__pycache__'))
for name in ['package.json','package-lock.json']:shutil.copy2(root/name,tmp/name)
env={'PATH':os.environ['PATH'],'HOME':str(tmp),'npm_config_cache':str(pathlib.Path.home()/'.npm'),'NEXT_TELEMETRY_DISABLED':'1','PYTHONDONTWRITEBYTECODE':'1'}
global_config=tmp/'empty-global.npmrc';global_config.write_text('')
commands=[['npm','ci','--ignore-scripts','--no-audit','--no-fund','--userconfig=/dev/null','--globalconfig='+str(global_config)],['npm','run','build','--workspace','@vexa/web','--userconfig=/dev/null','--globalconfig='+str(global_config)]]
results=[]
for i,command in enumerate(commands):
 log=evidence/f'prepare-{tag}-{i}.txt'
 with log.open('w') as out:r=subprocess.run(command,cwd=tmp,env=env,stdout=out,stderr=subprocess.STDOUT)
 results.append({'command':command,'exit_code':r.returncode,'log':str(log)})
 if r.returncode:break
(evidence/f'prepare-{tag}.json').write_text(json.dumps({'tmp':str(tmp),'results':results},indent=2))
(evidence/'product-tmp-path.txt').write_text(str(tmp))
print('PRODUCT_TMP',tmp,'EXIT',r.returncode);raise SystemExit(r.returncode)
