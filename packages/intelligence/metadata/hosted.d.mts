type MetadataWorker={idle?:boolean;metadata?:{tick():Promise<unknown>};close():Promise<unknown>};
export function createMetadataHostedHandler(options:{runtime:(binding:{deadlineAt:number})=>Promise<MetadataWorker>;secret?:string}):(request:Request)=>Promise<Response>;
