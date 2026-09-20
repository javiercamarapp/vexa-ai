import type {Repository} from './repository.mjs';
export function createJobsHandler(repository:Repository):(request:Request)=>Promise<Response>;
