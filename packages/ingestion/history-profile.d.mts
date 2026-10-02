import type {SourceEnvelope,HistoricalTimestamp} from './index';
export const HISTORY_PROFILE:'history-message-v1';
export function checkedProfile(profile:unknown):'history-message-v1'|undefined;
export function historicalText(text:unknown):string;
export function historicalTimestamp(value:unknown):HistoricalTimestamp;
export function historyMetadata(text:unknown,original:unknown):HistoricalTimestamp;
export function historicalIdentity(id:unknown,conversation:unknown,role:unknown):void;
export function validateHistoryPayload(envelope:SourceEnvelope,raw:Record<string,unknown>):void;
