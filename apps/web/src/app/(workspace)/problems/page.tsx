import {SharedWorkspacePanel} from '../../../components/workspace/shared-panel';
import {ProblemTabs} from '../../../components/workspace/problem-tabs';
import {queryParams,type Query} from '../../../lib/workspace/view';
export const metadata={title:'Problemas de negocio'};
export default async function Page({searchParams}:{searchParams:Query}){const query=queryParams(await searchParams).toString();return <><ProblemTabs/><SharedWorkspacePanel key="problems" resource="problems" initialQuery={query}/></>;}
