export interface Horizon {as_of:string;unit:'day'|'month';quantity:number;version:string}
export interface MoneyWindow {start:string;end:string;timezone:string;date_basis:string;horizon?:Horizon|null}
export class ScopeContractError extends Error {code:string;constructor(code:string)}
export function validUtc(value:unknown):boolean;
export function validateWindow(input:MoneyWindow):MoneyWindow & {horizon:Horizon|null};
export function containsInstant(window:MoneyWindow,instant:string):boolean;
export function assertCompatibleWindows(windows:MoneyWindow[]):MoneyWindow;
