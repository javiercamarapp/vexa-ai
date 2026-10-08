// Import this control BEFORE importing a candidate. No injected transport in this facade.
import {createObserverCore} from './observer-core.mjs';
const capturedNativeFetch=globalThis.fetch.bind(globalThis);
export function createNativeObserver(options){
 if(Object.hasOwn(options??{},'capturedFetch'))throw new Error('OBS_NATIVE_TRANSPORT_OVERRIDE');
 return createObserverCore({...options,capturedFetch:capturedNativeFetch});
}
