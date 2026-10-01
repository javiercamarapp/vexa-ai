export type DeliveryPolicy={channel:'inapp'|'email'|'push';version:number;enabled:boolean;intervalMs:number;digestWindowMs:number;maxAttempts:number;lifetimeMs:number};
export function createDeliveryPolicyRepository(options:{database:unknown}):{list():Promise<DeliveryPolicy[]>;save(input:unknown):Promise<{channel:string;version:number}>};
