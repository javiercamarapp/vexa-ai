import type {NotificationRuntimeOptions} from './transports.mjs';
export function createTransports(env?:Record<string,string|undefined>,options?:NotificationRuntimeOptions):Promise<Record<string,unknown>>;
