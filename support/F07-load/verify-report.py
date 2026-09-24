# External control derived from independent reviewer358, bound to measured source manifest.
import json,hashlib,sys,pathlib,math
p=pathlib.Path(sys.argv[1]);raw=p.read_bytes();d=json.loads(raw);root=p.parent
manifest=pathlib.Path(sys.argv[2]);manifest_bytes=manifest.read_bytes();source=json.loads(manifest_bytes)
assert d['dependencyManifestSha256']==hashlib.sha256(manifest_bytes).hexdigest()
assert d['baselineSha']==source['baselineSha']
assert d['candidate']==sys.argv[3], 'MEASURED_CANDIDATE_REQUIRED'
for name in ['generator.mjs','harness.mjs','run.mjs','worker.mjs','dependencies.json']:
 assert d['benchmarkImplementation'][name]==hashlib.sha256((manifest.parent/name).read_bytes()).hexdigest(), 'BENCHMARK_SOURCE_BINDING'
assert d['status']=='measured', 'ALL_SCALES_MUST_FINISH'
assert [x['rows'] for x in d['scales']]==[10000,50000,150000]
assert all(x['status']=='pass' for x in d['scales'])
checks=[]
assert d['proposalDependencies'] is False
assert d['synthetic'] is True
assert d['slo']['approved'] is False
assert d['indexes'] and d['samples']
assert len(d['processes'])==3 and all(x.get('endedAt') for x in d['processes'])
assert d['cost']['total'] is None and d['cost']['measured'] is False
for s in d['scales']:
 if s['status']!='pass':continue
 n=s['rows'];assert s['observed']=={'total':n,'accepted':n*98//100,'rejected':n//100,'duplicates':n//100,'pending':0}
 actual=0
 for f in s['files']:
  assert pathlib.Path(f['filename']).name==f['filename'] and f['filename'].endswith('.csv'), 'DATASET_FILENAME'
  b=(root/('dataset-'+str(n))/f['filename']).read_bytes();assert hashlib.sha256(b).hexdigest()==f['sha256'];lines=b.decode().splitlines();assert len(lines)-1==f['rows'];assert f['rows']<=50000 and len(b)<=20971520;actual+=len(lines)-1
  assert f['observed']['fileHash']==f['sha256'];assert int(f['observed']['pending'])==0
  assert f['jobTiming']['state'] in ('succeeded','partial')
 assert actual==n
 chunks=s['chunks'];assert len(chunks)==n//100
 for f in s['files']:
  relevant=[x for x in chunks if x['jobId']==f['jobId']];assert [x['offset'] for x in relevant]==list(range(100,f['rows']+1,100));assert relevant[-1]['done'] is True
 times=sorted(x['commitMs']for x in chunks);p95=times[math.ceil(len(times)*.95)-1];assert abs(p95-s['metrics']['commitP95Ms'])<1e-6
 assert abs(n/(s['processingMs']/1000)-s['metrics']['inputRowsPerSecond'])<1e-6
 explain=json.loads(s['explain']);assert explain[0]['Plan'];assert s['concurrency']==1 and s['workerChunkRows']==100 and s['jobDeadlineMs']==900000
 checks.append({'rows':n,'recount':actual,'p95Recomputed':p95,'chunks':len(chunks),'datasetHashes':len(s['files']),'explain':True,'endToEndMs':s['endToEndMs'],'processingMs':s['processingMs'],'metrics':s['metrics']})
if d['status']=='measured':
 assert len(checks)==3;assert d['cleanup']['ownResourcesRemoved'] and d['cleanup']['temporaryPathsRemoved'];assert all(x['absent'] for x in d['cleanup']['resources'])
print(json.dumps({'report':str(p),'sha256':hashlib.sha256(raw).hexdigest(),'status':d['status'],'checks':checks},indent=2))
