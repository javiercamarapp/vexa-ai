import assert from 'node:assert/strict';
export function readyContract(url){const path=new URL(url).pathname;
 if(path==='/login')return{path,kind:new URL(url).searchParams.has('error')?'login-error':'login'};
 if(path==='/auth/email/complete')return{path,kind:'invalid-email-link'};
 const detail=path.match(/^\/(problems|customers)\/([^/]+)$/),brief=path.match(/^\/briefs\/([^/]+)$/);
 if(detail)return{path,api:'/api/workspace/detail/'+(detail[1]==='problems'?'problem':'customer')+'/'+detail[2],selector:'section[aria-label="Detalle financiero autorizado"] section[aria-label="Componentes financieros"]'};
 if(brief)return{path,api:'/api/briefs/'+brief[1],selector:'article[aria-label^="Brief versión "]'};
 const map={
 '/overview':['/api/workspace','section[aria-label="Resumen con alcance compartido"] .record-card'],
 '/problems':['/api/workspace','section[aria-label="Problemas con alcance compartido"] .record-card'],
 '/recommendations':['/api/recommendations','article[aria-label^="Recomendación:"]'],
 '/interventions':['/api/interventions','article[id^="intervention-"]'],
 '/explorer':['/api/explorer','article[aria-label^="Problema:"]'],
 '/notifications':['/api/notifications','ul[aria-label="Avisos disponibles"]'],
 '/settings/notifications':['/api/notifications/preferences','fieldset.record-card'],
 '/notifications/push':['/api/notifications/push','ul[aria-label="Dispositivos registrados"]'],
 '/settings/notification-delivery':['/api/notifications/delivery','#delivery-policy-inapp'],
 '/settings/team':['/api/team','section[aria-busy="false"] ul li']};
 assert.ok(map[path],'READY_CONTRACT_MISSING:'+path);return{path,api:map[path][0],selector:map[path][1]};
}
export function assertReadyEvidence(r){
 assert.equal(r.busy,0,'READY_STILL_LOADING');assert.equal(r.loadingText,0,'READY_LOADING_TEXT');assert.ok(r.marker,'READY_DATA_MARKER_MISSING');
 if(r.kind==='login-error'||r.kind==='invalid-email-link')assert.equal(r.errors,1,'EXPECTED_AUTH_ERROR_MISSING');
 else assert.equal(r.errors,0,'READY_ERROR_SHELL');
 if(r.api){assert.ok(r.apiObserved,'READY_API_NOT_OBSERVED');assert.equal(r.apiStatus,200,'READY_API_NOT_SUCCESS');}
}
export async function assertReady(page,url,requests){
 const c=readyContract(url),main=page.locator('main');
 let marker;
 if(c.kind==='login'||c.kind==='login-error'){await main.getByRole('heading',{name:/Bienvenido.*VEXA AI/}).waitFor();marker=await main.locator('form[action="/auth/google"] button').count()===1&&await main.locator('input[type="email"]').count()===1;}
 else if(c.kind==='invalid-email-link'){await main.getByRole('alert').filter({hasText:'El enlace no es válido'}).waitFor();marker=await main.getByRole('link',{name:'Volver a iniciar sesión',exact:true}).isVisible();}
 else if(c.path==='/notifications'){const populated=main.locator('article[data-notification-id]'),empty=main.getByText('No hay avisos sin leer disponibles.',{exact:true});await populated.or(empty).first().waitFor();const populatedCount=await populated.count();marker=populatedCount>0?await populated.first().isVisible():await empty.isVisible();c.state=populatedCount>0?'ready':'empty';c.itemCount=populatedCount;}
 else{await main.locator(c.selector).first().waitFor();marker=await main.locator(c.selector).first().isVisible();}
 const responses=requests.filter(x=>x.method==='GET'&&x.path===c.api);const r={...c,marker,busy:await main.locator('[aria-busy="true"]').count(),loadingText:await main.getByRole('status').filter({hasText:/^(Verificando|Cargando|Validando sesión)/}).count(),errors:await main.locator('.state-panel.error,p[role="alert"]').count(),apiObserved:responses.length>0,apiStatus:responses.at(-1)?.status};
 assertReadyEvidence(r);return r;
}
