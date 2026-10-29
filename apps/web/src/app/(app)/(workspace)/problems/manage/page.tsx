import {ProblemsPanel} from '../../../../../components/problems-panel';
import {ProblemTabs} from '../../../../../components/workspace/problem-tabs';
import {metaTitulo} from '../../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.problems-manage');
export default function Page(){return <><ProblemTabs/><ProblemsPanel/></>;}
