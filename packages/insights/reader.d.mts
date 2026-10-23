export const INSIGHTS: readonly string[];
export function createInsightsReader(options: {database: unknown}): {
  conversationVolume(o?: {grain?: string}): Promise<any>; refundBySkuMonth(o?: {from?: string | null; to?: string | null; currency?: string; top?: number}): Promise<any>;
  threadResolution(o?: object): Promise<any>; trackerRefundStatus(o?: object): Promise<any>; freshness(o?: {now?: number}): Promise<any>; all(o?: object): Promise<any>;
};
