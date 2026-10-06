import {createSnapshotRepository} from '../metrics/snapshots.mjs';
import {check,parseWorkspaceQuery} from './contracts.mjs';
import {publicationQuery} from './navigation.mjs';
/** Only a bare overview may adopt another period. Never reinterpret an explicit filter or pin. */
export async function initialOverviewScope(scope,query){
 if(!(query instanceof URLSearchParams)||[...query.keys()].some(key=>key!=='resource')||(query.get('resource')??'metrics')!=='metrics')return null;
 const {rows}=await scope.query("SELECT id FROM public.metric_snapshots WHERE tenant_id=$1 AND status='published' AND economic_schema_version='economic-snapshot-v1' ORDER BY published_at DESC,id DESC LIMIT 1",[scope.tenantId]);
 if(!rows.length)return null;
 // The selected row is not trusted until the existing repository rechecks contributors,
 // captured evidence, configuration and integrity within this same authorized transaction.
 const repository=createSnapshotRepository({database:{transaction:async(_action,work)=>work(scope)}});
 const snapshot=await repository.get({snapshotId:rows[0].id});
 check(snapshot.status==='published','snapshot_not_published',403);
 const selected=publicationQuery(snapshot);
 check(selected,'snapshot_scope_unrepresentable',409);
 return parseWorkspaceQuery(selected).scope;
}
