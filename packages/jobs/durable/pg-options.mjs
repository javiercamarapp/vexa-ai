import {X509Certificate} from 'node:crypto';

/** Optional private deployment CA; URI SSL parameters cannot override verification. */
export function databasePoolOptions(connectionString,caPem) {
 const base={connectionString,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000};
 if(caPem===undefined)return base;
 const invalid=()=>new Error('database_tls_configuration_invalid');
 if(!caPem.trim()||Buffer.byteLength(caPem)>262144)throw invalid();
 let url;try{url=new URL(connectionString);}catch{throw invalid();}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname)throw invalid();
 // pg can reinterpret an encoded hostname or host query as a plaintext Unix socket.
 try{if(decodeURIComponent(url.hostname).includes('/'))throw invalid();}catch{throw invalid();}
 for(const key of url.searchParams.keys())if(['ssl','sslmode','sslcert','sslkey','sslrootcert','sslnegotiation','uselibpqcompat','host'].includes(key.toLowerCase()))throw invalid();
 const certificates=caPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
 if(!certificates?.length||caPem.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,'').trim())throw invalid();
 try{for(const certificate of certificates)if(!new X509Certificate(certificate).ca)throw invalid();}catch{throw invalid();}
 return {...base,ssl:{ca:caPem,rejectUnauthorized:true}};
}
