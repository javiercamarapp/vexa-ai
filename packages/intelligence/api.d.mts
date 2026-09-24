export function extractionFailure(error:unknown):Response;
export function createExtractionHandler(options:{database:any;resolveConfig:(tenantId:string)=>any;runtime?:string;env?:NodeJS.ProcessEnv;runtimeCode?:Record<string,string>}):(request:Request)=>Promise<Response>;
