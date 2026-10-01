export type NotificationRuntimeOptions={createDatabase?:any;pool?:any;deadlineAt?:number};
export function createTransports(env?:Record<string,string|undefined>,options?:NotificationRuntimeOptions):Promise<Record<string,unknown>>;
