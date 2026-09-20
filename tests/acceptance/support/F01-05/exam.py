"""Four real jobs; aggregate only live process statuses, never supplied receipts."""
import argparse, json, pathlib, subprocess, sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'ci'))
from contract import validate, JOBS

def aggregate(candidate):
    validate(candidate/'.github/workflows/ci.yml')
    results=[]
    for job in JOBS:
        r=subprocess.run([sys.executable,'-B',str(pathlib.Path(__file__).resolve().parents[1]/'ci/run.py'),'--job',job,'--candidate',str(candidate)])
        results.append({'job':job,'exit_code':r.returncode})
    code=0 if len(results)==4 and all(r['exit_code']==0 for r in results) else 1
    print(json.dumps({'task_id':'F01-05','jobs':results,'exit_code':code,'run_id':'pending'}),flush=True)
    return code

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--candidate',type=pathlib.Path,required=True);a=p.parse_args()
    try: sys.exit(aggregate(a.candidate.resolve()))
    except ValueError as e:
        print(json.dumps({'status':'policy_fail','reason':str(e),'run_id':'pending'}));sys.exit(1)
