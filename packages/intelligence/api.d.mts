export function extractionFailure(error:unknown):Response;
export function createExtractionHandler(options:{database:any;resolveConfig:(tenantId:string)=>any;runtime?:string}):(request:Request)=>Promise<Response>;
