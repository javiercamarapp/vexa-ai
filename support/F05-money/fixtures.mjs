// SYN-F05-MONEY-262: invented financial records, never customer evidence or live FX.
export const catalog={version:'SYN-currency-2026-v1',currencies:{USD:2,MXN:2,JPY:0,KWD:3}};
export const window={start:'2026-09-01T00:00:00.000Z',end:'2026-10-01T00:00:00.000Z',timezone:'America/Merida',date_basis:'occurred_at',horizon:null};
export const metric=(patch={})=>({metric_id:'SYN-order-exposure-A',tenant_id:'SYN-tenant-A',currency:'USD',exponent:2,catalog_version:catalog.version,window,basis:'net_order_excluding_tax_shipping',grain:'unique_order',amount_minor:'30000',known_subtotal:'30000',coverage:{known_n:2,eligible_n:2},status:'complete',missing_reasons:[],provenance:[{source:'SYN-ledger',reference:'SYN-approved-operational-source',version:'SYN-v1'}],additive:true,...patch});
export const partial=(patch={})=>metric({amount_minor:null,known_subtotal:'30000',coverage:{known_n:2,eligible_n:3},status:'partial',missing_reasons:['SYN-unknown-order-amount'],...patch});
export const unknown=(patch={})=>partial({metric_id:'SYN-unknown',known_subtotal:null,coverage:{known_n:0,eligible_n:1},status:'unavailable',...patch});
export const fx=(patch={})=>({approved:true,approval_ref:'SYN-owner-approval-not-live-rate',source:'SYN-rate-source',date:'2026-09-21',version:'SYN-FX-v1',base:'USD',quote:'MXN',rate:'17.125',rounding:'half_even',...patch});
