export function createExtractionConfigResolver(raw?:string):(tenantId:string)=>any;
export function createExtractionRuntime(options:any):{queue:any;tick():Promise<any>};
