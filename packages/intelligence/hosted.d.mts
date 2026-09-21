export function createExtractionHostedHandler(options:{runtime:()=>Promise<any>;secret?:string}):(request:Request)=>Promise<Response>;
