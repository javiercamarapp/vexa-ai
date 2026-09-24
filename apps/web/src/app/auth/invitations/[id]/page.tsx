export const metadata={referrer:'no-referrer' as const};
import {TeamInvitation} from '../../../../components/team-invitation';
export default async function Page({params}:{params:Promise<{id:string}>}){return <TeamInvitation id={(await params).id}/>;}
