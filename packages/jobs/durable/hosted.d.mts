export function createHostedHandler(options:{runtime:()=>Promise<any>;secret?:string;timeoutMs?:number;platformTimeoutMs?:number;intervalMs?:number}):(request:Request)=>Promise<Response>;
