import {z} from 'zod';
import {identity} from '@/server/auth';
import {failure} from '@/server/http';
import {readState} from '@/server/store';
import {sqlConnect} from '@/server/sql-connect-store';
import {normalizeWorkspacePage} from '@/domain/sql-connect';
import {physicalCalendarStatus} from '@/domain/calendar-status';
import type {SupportSession} from '@/domain/types';
export const runtime='nodejs';
export async function GET(request:Request){try{const user=await identity(request),seasonId=z.string().uuid().parse(new URL(request.url).searchParams.get('seasonId')),admin=user.role==='ADMIN',coaches=user.staffFunctions?.includes('PHYSICAL')?user.staffCoachIds||[]:[];let rows:SupportSession[]=[];
 if(admin||coaches.length){if(process.env.CDIR_DATABASE==='sql-connect'){for(let offset=0;;offset+=500){const scope=admin?'':'coachId:{in:$coaches},',definition=admin?'':', $coaches:[UUID!]!',variables:Record<string,unknown>={sid:seasonId,offset};if(!admin)variables.coaches=coaches;const response=await sqlConnect().executeGraphqlRead<Record<string,unknown>,Record<string,unknown>>(`query CalendarStatus($sid:UUID!, $offset:Int!${definition}) @auth(level:NO_ACCESS){supportSessions(where:{seasonId:{eq:$sid},kind:{eq:"PHYSICAL"},${scope}},limit:500,offset:$offset,orderBy:{id:ASC}){id seasonId coachId teamId venueId kind title startsAt endsAt status}}`,{variables});const page=normalizeWorkspacePage(response.data).supportSessions;rows.push(...page);if(page.length<500)break;}}else rows=(await readState()).supportSessions.filter(x=>admin||coaches.includes(x.coachId));}
 return Response.json(physicalCalendarStatus(rows,seasonId),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
