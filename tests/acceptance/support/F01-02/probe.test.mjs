// Probe of the signature oracle, NOT product acceptance or Google OAuth.
import test from 'node:test';
import assert from 'node:assert/strict';
import {local,signatureOracle} from './harness.mjs';

test('real local Auth positive + signature defect killed by AUTH_SIGNATURE', {timeout:90000},async()=>{
  const h=await local(process.env.VEXA_CANDIDATE);
  try {
    const {session}=await h.user();
    const reference=async token=>{const {data,error}=await h.client.auth.getUser(token);return !error && !!data.user;};
    await signatureOracle(reference,session.access_token);
    const insecureProbe=async token=>!!JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;
    await assert.rejects(signatureOracle(insecureProbe,session.access_token),error=>error.code==='ERR_ASSERTION' && error.message.includes('AUTH_SIGNATURE'));
  }finally{await h.close();}
});
