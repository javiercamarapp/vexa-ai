const assert=require('node:assert/strict');
function dependencyRoute(pathname){
 if(['/overview','/problems','/recommendations','/explorer','/interventions','/briefs'].includes(pathname))return {path:'/api/workspace',contract:'f06-workspace-v1',code:'workspace_request_failed'};
 const detail=pathname.match(/^\/(problems|customers)\/([0-9a-f-]{36})$/i);
 assert.ok(detail,'DEPENDENCY_ROUTE_UNMAPPED');
 return {path:'/api/workspace/detail/'+(detail[1]==='problems'?'problem':'customer')+'/'+detail[2],contract:'f06-detail-v1',code:'detail_request_failed'};
}
function dependencyHeaders(headers){
 assert.match(headers['content-type']??'',/^application\/json(?:;|$)/i,'DEPENDENCY_HTTP_JSON');
 assert.match(headers['cache-control']??'',/(?:^|,)\s*private\s*(?:,|$)/i,'DEPENDENCY_HTTP_PRIVATE');
 assert.match(headers['cache-control']??'',/(?:^|,)\s*no-store\s*(?:,|$)/i,'DEPENDENCY_HTTP_NO_STORE');
}
function dependencyResponse(status,headers,envelope,expected){
 assert.equal(status,503,'DEPENDENCY_HTTP_STATUS');
 assert.equal(envelope?.contract_version,expected.contract,'DEPENDENCY_HTTP_CONTRACT');
 assert.equal(envelope?.error?.code,expected.code,'DEPENDENCY_HTTP_CAUSE');
 assert.equal(envelope?.error?.retryable,true,'DEPENDENCY_HTTP_RETRYABLE');
 assert.equal(typeof envelope?.error?.message,'string','DEPENDENCY_HTTP_MESSAGE');
 assert.match(envelope?.meta?.trace_id??'',/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,'DEPENDENCY_HTTP_TRACE');
 assert.equal(Object.hasOwn(envelope,'data'),false,'DEPENDENCY_HTTP_NO_DATA');
 dependencyHeaders(headers);
 assert.doesNotMatch(JSON.stringify(envelope),/ONLY_B_|workspace_identity_unavailable|organizations_unavailable|authentication_required|Bearer |access_token|refresh_token/,'AUTH_NOT_DEPENDENCY');
}
function dependencyPresentation(alerts,body){
 assert.ok(alerts.length>=1,'DEPENDENCY_VISIBLE');
 assert.match(alerts.join('\n'),/No (?:se pudo|pudimos)|no (?:está )?disponible/i,'DEPENDENCY_SPECIFIC');
 assert.match(alerts.join('\n'),/reintenta|actualiza|intentar|configur/i,'DEPENDENCY_ACTIONABLE');
 assert.doesNotMatch(body,/ONLY_B_|Snapshot disponible|Sin resultados para este alcance|No hay (?:una )?publicaci[oó]n|Snapshot:|Ingresos expuestos|No hay (?:problemas|intervenciones|recomendaciones)|Brief versi[oó]n \d/i,'DEPENDENCY_NOT_READY');
}
module.exports={dependencyRoute,dependencyHeaders,dependencyResponse,dependencyPresentation};
