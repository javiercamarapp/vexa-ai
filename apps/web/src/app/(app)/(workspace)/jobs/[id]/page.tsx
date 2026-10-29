import {JobProgress} from '../../../../../components/job-progress';
import {metaTitulo} from '../../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.jobs-id');
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <JobProgress id={id}/>;}
