/** Server-owned 100-chunk cap within the CRM time slice; requests cannot override it. */
export function createCRMHostedHandler(options:{runtime:()=>Promise<any>;secret?:string;timeoutMs?:number}):(request:Request)=>Promise<Response>;
