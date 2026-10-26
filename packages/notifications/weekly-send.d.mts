type Recipient = {tenantId: string; userId: string; channel: string; email: string; emailVerified: boolean};
type WeeklyInput = {tenantId: string; userId: string; subject?: string; html?: string; text?: string; headers: Record<string, string>; idempotencyKey: string; signal?: AbortSignal};
type Delivery = ((m: WeeklyInput) => Promise<{ok: boolean; providerId?: string; motivo?: string}>) & {close(): Promise<void>};
export function crearEntregaSemanal(o: {email: {
  configured(): Promise<boolean> | boolean;
  resolveRecipient(i: {tenantId: string; userId: string}, o?: {signal?: AbortSignal}): Promise<Recipient | null>;
  sendWeekly(i: {recipient: Recipient; headers: Record<string, string>; idempotencyKey: string; signal?: AbortSignal}): Promise<{kind: string; providerId?: string}>;
  close?(): Promise<void>;
}}): Delivery;
export function entregaDesdeEntorno(env?: Record<string, string | undefined>): Promise<Delivery | null>;
