import assert from 'node:assert/strict';
export function redirectOracle(next,destination,origin) {
  const dest=new URL(destination,origin);
  assert.equal(dest.origin,origin,'REDIRECT_ORIGIN: callback escaped origin');
  const requested=new URL(next,origin);
  if(next.startsWith('/') && requested.origin===origin)assert.equal(dest.pathname,requested.pathname,'REDIRECT_LOCAL: lost allowed destination');
}
export function revocationOracle(status,location,origin) {
  const target=location ? new URL(location,origin) : null;
  assert.ok([401,403,404].includes(status) || ([302,303,307,308].includes(status) && target?.origin===origin && target.pathname==='/login'),'REVOKED: cached membership still grants access');
}
