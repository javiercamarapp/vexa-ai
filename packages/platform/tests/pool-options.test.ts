import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {databasePoolOptions} from '../src/pool-options.ts';
const folder=mkdtempSync(join(tmpdir(),'vexa-ca-test-'));
try {
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(folder,'key.pem'),'-out',join(folder,'ca.pem'),'-days','1','-subj','/CN=SYN Test CA','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore'});
 const ca=readFileSync(join(folder,'ca.pem'),'utf8'),url='postgresql://runtime:secret@example.invalid:5432/postgres';
 test('local configuration remains compatible without a custom CA',()=>assert.deepEqual(databasePoolOptions(url),{connectionString:url,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000}));
 test('explicit CA always verifies server certificate',()=>assert.deepEqual(databasePoolOptions(url,ca).ssl,{ca,rejectUnauthorized:true}));
 test('CA rotation bundle supports multiple trusted roots',()=>assert.equal(databasePoolOptions(url,ca+'\n'+ca).ssl?.rejectUnauthorized,true));
 for(const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert','useLibpqCompat','SSLMode','sslnegotiation','host'])test('rejects conflicting URL parameter '+key,()=>assert.throws(()=>databasePoolOptions(url+'?'+key+'=disable',ca),{message:'database_tls_configuration_invalid'}));
 for(const value of ['', 'garbage','-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----',ca+'\nPRIVATE KEY','x'.repeat(262145)])test('rejects invalid CA content length '+value.length,()=>assert.throws(()=>databasePoolOptions(url,value),{message:'database_tls_configuration_invalid'}));
 test('encoded Unix socket hostname rejected with explicit CA',()=>assert.throws(()=>databasePoolOptions('postgresql://runtime:secret@%2Ftmp%2Fpg/postgres',ca),{message:'database_tls_configuration_invalid'}));
 test('invalid URL error does not leak credentials',()=>assert.throws(()=>databasePoolOptions('private-password',ca),{message:'database_tls_configuration_invalid'}));
 test('non PostgreSQL URI rejected',()=>assert.throws(()=>databasePoolOptions('https://example.invalid',ca),{message:'database_tls_configuration_invalid'}));
} finally {rmSync(folder,{recursive:true,force:true});}
