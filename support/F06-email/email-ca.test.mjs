import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';import path from 'node:path';const {createTransports}=await import(pathToFileURL(path.join(process.env.VEXA_CANDIDATE,'packages/notifications/email.mjs')));
test('configured private database CA must be validated before opening a pool',async()=>{
 let channel;try{await assert.rejects(async()=>{channel=await createTransports({VEXA_EMAIL_DATABASE_URL:'postgres://syn:syn@127.0.0.1:58434/postgres',VEXA_EMAIL_DATABASE_CA_PEM:'invalid-certificate',VEXA_EMAIL_MODE:'mailpit',VEXA_EMAIL_FROM:'vexa@syn.test',VEXA_APP_ORIGIN:'https://vexa.test',VEXA_MAILPIT_SMTP_PORT:'60825'});},/database_tls_configuration_invalid/);}finally{await channel?.email?.close();}
});
