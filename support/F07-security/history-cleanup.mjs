import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

// Recovery only for this wrapper's exclusive journal and broker. Never discover
// by a broad Docker name prefix, delete by unverified name or touch shared DBs.
export function recoverOwnedResources({journal,broker,evidence}){
  const deadline=Date.now()+90000,results=[];
  assert.match(broker,/^[0-9a-f-]{36}$/);
  assert.equal(fs.lstatSync(journal).isSymbolicLink(),false);
  assert.equal(fs.statSync(journal).mode&0o777,0o600);
  const entries=fs.readFileSync(journal,'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const own=[...new Map(entries.map(row=>[row.kind+':'+row.name,row])).values()];
  for(const row of own){
    assert.equal(row.broker,broker,'RECOVERY_BROKER_MISMATCH');
    assert.ok(['container','network'].includes(row.kind));
    assert.match(row.name,/^vexa-f01-0[234]-[0-9a-f-]{36}(?:-[a-z]+)?$/);
  }
  const command=args=>{
    const remaining=deadline-Date.now();assert.ok(remaining>0,'RECOVERY_DEADLINE');
    const result=spawnSync('docker',args,{encoding:'utf8',timeout:Math.min(10000,remaining)});
    assert.ok(!result.error,'RECOVERY_DOCKER_COMMAND');return result;
  };
  try{
    for(const row of own.sort((a,b)=>(a.kind==='network')-(b.kind==='network'))){
      const inspect=()=>{
        const result=command([row.kind,'inspect',row.name,'--format',`{{.Id}}|{{.Name}}|{{ index ${row.kind==='network'?'.Labels':'.Config.Labels'} "vexa.ci.broker" }}`]);
        if(result.status!==0){assert.match(result.stderr,/No such (?:object|container|network)|not found/i,'RECOVERY_INSPECT');return null;}
        const [id,name,owner]=result.stdout.trim().split('|');
        assert.match(id,/^[a-f0-9]{64}$/);assert.equal(name.replace(/^\//,''),row.name);assert.equal(owner,broker,'RECOVERY_LABEL_MISMATCH');return id;
      };
      const id=inspect();
      if(id){const removed=command(row.kind==='network'?['network','rm',id]:['container','rm','-f','-v',id]);assert.equal(removed.status,0,'RECOVERY_REMOVE');assert.equal(inspect(),null,'RECOVERY_STILL_PRESENT');}
      results.push({...row,id,absent:true});
    }
  }finally{fs.writeFileSync(evidence,JSON.stringify({broker,results,recorded:own.length,complete:results.length===own.length},null,2),{mode:0o600});}
}
