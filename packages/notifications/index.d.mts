export type NotificationChannel='inapp'|'email'|'push';
export type NotificationType='membership.welcome'|'membership.invited'|'brief.available'|'intervention.assigned'|'connection.attention'|'processing.failed';
export type CatalogEntry={type:NotificationType;label:string;description:string;connected:boolean};
export type Preference={channel:NotificationChannel;eventType:NotificationType|'*';enabled:boolean;version:number};
export type NotificationItem={id:string;type:NotificationType;resourceId:string;title:string;body:string;href:string;createdAt:string;readAt:string|null};
export type InboxView={items:NotificationItem[];nextCursor:string|null;status:'all'|'unread';limit:number};
export type PreferencesView={catalog:CatalogEntry[];channels:{id:NotificationChannel;label:string;deliveryAvailable:boolean;reason:string}[];preferences:Preference[]};
export class NotificationError extends Error{status:number;code:string;constructor(code:string,status?:number)}
export const catalog:readonly CatalogEntry[];
export function createNotificationRepository(options:{database:{transaction<T>(action:'read'|'notify',fn:(s:{tenantId:string;userId:string;role:string;permissionsVersion:number;query<R=Record<string,unknown>>(text:string,values?:readonly unknown[]):Promise<{rows:R[];rowCount:number|null}>})=>Promise<T>):Promise<T>}}):{inbox(input:{query:URLSearchParams}):Promise<InboxView>;preferences():Promise<PreferencesView>;setPreference(input:Preference & {expectedVersion:number} | {channel:NotificationChannel;eventType:NotificationType|'*';enabled:boolean;expectedVersion:number}):Promise<Preference>;markRead(input:{id:string}):Promise<{id:string;readAt:string}>};
