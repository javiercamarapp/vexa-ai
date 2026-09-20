import {AccessError} from '../../platform/src/session.ts';
export class JobError extends AccessError {constructor(code,status=409){super(status,code);}}
export const fail=(code,status)=>{throw new JobError(code,status);};
