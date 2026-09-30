import type {CRMWebhookBinding,CRMWebhookAdmission} from './webhooks.mjs';
export function createCRMWebhookRepository(options:{database:any}):{record(input:{binding:CRMWebhookBinding;digest:string}):Promise<CRMWebhookAdmission>};
