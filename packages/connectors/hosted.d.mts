export function createCRMHostedHandler(options:{runtime:()=>Promise<any>;secret?:string;timeoutMs?:number}):(request:Request)=>Promise<Response>;
