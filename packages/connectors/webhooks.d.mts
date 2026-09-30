export interface CRMWebhookBinding {readonly id:string;readonly tenantId:string;readonly connectionId:string;readonly source:'hubspot'|'zendesk';readonly accountId:string;readonly secret:string;readonly appId?:string;readonly url:string}
export interface CRMWebhookBindings {readonly origin:string;resolve(id:string):CRMWebhookBinding}
export function createCRMWebhookBindings(raw:string,origin:string):CRMWebhookBindings;
export function verifyCRMWebhook(input:{binding:CRMWebhookBinding;body:Buffer;headers:Headers;now?:number}):{readonly digest:string};
export type CRMWebhookAdmission={status:'accepted'|'duplicate'|'rate_limited'|'unavailable'};
export function createCRMWebhookHandler(options:{bindings:CRMWebhookBindings;record(input:{binding:CRMWebhookBinding;digest:string}):Promise<CRMWebhookAdmission>;clock?:()=>number;readTimeoutMs?:number}):(request:Request)=>Promise<Response>;
