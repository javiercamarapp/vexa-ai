import {JobProgress} from '../../../../components/job-progress';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <JobProgress id={id}/>;}
