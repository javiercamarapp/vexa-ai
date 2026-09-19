import { NextRequest } from 'next/server';
import { ACTIVE_ORG, AccessError, assertOrigin, authorizeSelection, config, identity } from '../../../lib/auth';
import { failure, localRedirect, requestAuth } from '../../../lib/auth-http';
export async function POST(request:NextRequest) {
  try {
    const c=config();if(!c)throw new AccessError(503,'auth_not_configured');
    assertOrigin(request.headers.get('origin'),c.origin);
    const form=await request.formData();const tenant=form.get('tenant_id');
    if(typeof tenant!=='string')throw new AccessError(403,'organization_not_authorized');
    const {client,finish}=requestAuth(request);
    try {
      const membership=await authorizeSelection(identity(client),tenant);
      const response=localRedirect('/');
      response.cookies.set(ACTIVE_ORG,membership.tenant_id,{httpOnly:true,secure:c.secure,sameSite:'lax',path:'/',maxAge:60*60*24*30});
      return finish(response);
    } catch(error) { return finish(failure(error)); }
  } catch(error) {return failure(error);}
}
