export type NotificationHostedScope={deadlineAt:number;signal:AbortSignal};
export function createNotificationHostedHandler(options:{runtime:(scope:NotificationHostedScope)=>Promise<any>;transports:(scope:NotificationHostedScope)=>Promise<Record<string,any>>;secret?:string;timeoutMs?:number;sendTimeoutMs?:number;cleanupMs?:number}):(request:Request)=>Promise<Response>;
