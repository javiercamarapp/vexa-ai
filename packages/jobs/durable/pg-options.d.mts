export function databasePoolOptions(connectionString:string,caPem?:string):{
 connectionString:string;max:number;connectionTimeoutMillis:number;idleTimeoutMillis:number;
 ssl?:{ca:string;rejectUnauthorized:boolean};
};
