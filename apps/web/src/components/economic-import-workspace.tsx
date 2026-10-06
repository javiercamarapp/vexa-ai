'use client';
import {useState} from 'react';
import type {EconomicScope} from '../../../../packages/metrics/repository.mjs';
import {EconomicImportPanel} from './economic-import-panel';
import {EconomicPanel} from './economic-panel';
export function EconomicImportWorkspace({tenantId,canImport}:{tenantId:string;canImport:boolean}){
 const [imported,setImported]=useState<{scope:EconomicScope;revision:number}|null>(null);
 return <>{canImport&&<EconomicImportPanel key={tenantId} tenantId={tenantId} onImported={scope=>setImported(previous=>({scope,revision:(previous?.revision??0)+1}))}/>}<div id="economic-ledger"><EconomicPanel key={imported?.revision??0} initialScope={imported?.scope}/></div></>;
}
