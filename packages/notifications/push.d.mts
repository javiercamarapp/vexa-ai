export type PushDevice={id:string;deviceId:string;status:'active'|'revoked';expiresAt:string;version:number};
type Database={transaction<T>(action:'read'|'notify'|'import',fn:(s:{query<R=Record<string,unknown>>(text:string,values?:readonly unknown[]):Promise<{rows:R[];rowCount:number|null}>})=>Promise<T>):Promise<T>};
export function copyPushSubscription(input:unknown):{endpoint:string;keys:{p256dh:string;auth:string}};
export function pushConfiguration(env?:Record<string,string|undefined>):{subject:string;publicKey:string;privateKey:string}|null;
export function createPushRepository(options:{database:Database;sessionId?:string}):{list():Promise<PushDevice[]>;register(input:unknown,context:{deviceId:string;sessionId:string;expiresAt:number}):Promise<unknown>;revoke(id:string):Promise<unknown>;revokeSession(context:{global?:boolean;deviceId?:string}):Promise<unknown>};
export function createWebPushSender(options?:Record<string,unknown>):{configured():boolean;send(input:Record<string,unknown>):Promise<Record<string,unknown>>};
export function createPushTransport(options?:Record<string,unknown>):unknown;
export function retryAfter(value:unknown,now?:number):number|null;

export function availablePushConfiguration(env?:Record<string,string|undefined>):Promise<{subject:string;publicKey:string;privateKey:string}|null>;
