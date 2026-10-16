import type {AssociationRepository} from './repository.mjs';
export function createAssociationsHandler(repository:AssociationRepository,options?:{origin:string}):(request:Request)=>Promise<Response>;
