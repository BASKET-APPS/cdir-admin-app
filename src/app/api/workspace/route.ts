import {coachIdentity} from '@/domain/people';
import {createHash} from 'node:crypto';
import {serverAuth} from '@/server/firebase';
import {identity} from '@/server/auth';
import {visibleState} from '@/domain/permissions';
import {execute} from '@/domain/commands';
import {changedRows} from '@/domain/sql-connect';
import {sliceState,workspaceScope} from '@/domain/scope';
import type {Identity,State} from '@/domain/types';
import {saveAccount} from '@/server/bank';
import {sameOrigin,demoMode} from '@/server/mode';
import {failure,boundedJson} from '@/server/http';
import {readWorkspace,runCommand,isScoped,ensureRetentionReminders,type CommandResult} from '@/server/scoped-store';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
// GET ?seasonId= : the selected season (coaches: their teams). Older audit rows: /api/audit.
export async function GET(request:Request){try{const user=await identity(request);if(user.role==='ADMIN')await ensureRetentionReminders();const {state,version,auditHasMore,seasonId}=await readWorkspace(user,new URL(request.url).searchParams.get('seasonId'));const scoped=coachIdentity(state,user);return Response.json({user:scoped,mode:demoMode()?'demo':'firebase',state:visibleState(state,scoped),revision:version,seasonId,auditHasMore},{headers});}catch(e){return failure(e);}}
/** Only the changed rows the user is allowed to see. */
function patchFor(r:CommandResult,user:Identity){const ids=new Map<string,Set<string>>();for(const c of changedRows(r.before,r.after)){const set=ids.get(c.key)||new Set();set.add((c.row as {id:string}).id);ids.set(c.key,set);}const visible=visibleState(r.after,user) as unknown as Record<string,{id:string}[]>;return Object.fromEntries([...ids].map(([k,set])=>[k,(visible[k]||[]).filter(x=>set.has(x.id))]));}
export async function POST(request:Request){try{sameOrigin(request);const user=await identity(request);const body=await boundedJson(request);
 if(body.action==='memberByEmail'){if(user.role!=='ADMIN')throw Error('Sin permiso.');const email=String(body.payload.email).trim().toLowerCase();let uid;try{const account=await serverAuth().getUserByEmail(email);if(!account.emailVerified)throw Error('La cuenta debe verificar su correo de Google.');uid=account.uid;}catch(e){if((e as {code?:string}).code!=='auth/user-not-found')throw e;uid='invite:'+createHash('sha256').update(email).digest('hex');}body.action='member';body.payload={...body.payload,email,uid};}
 const action=String(body.action),scoped=isScoped(action);
 // Scoped commands run with the identity already resolved (teams and functions come from the identity query).
 const result=await runCommand(action,body.payload,body.expect,async(s:State)=>{if(scoped){execute(s,user,action,body.payload);return;}const actor=coachIdentity(s,user);if(action==='bank')await saveAccount(s,actor,body.payload);else execute(s,actor,action,body.payload);});
 if(scoped)return Response.json({patch:patchFor(result,user),revision:result.committed,previousRevision:result.version},{headers});
 const actor=coachIdentity(result.after,user),seasonId=typeof body.seasonId==='string'&&result.after.seasons.some(x=>x.id===body.seasonId)?body.seasonId:result.after.seasons.find(x=>x.current)?.id||result.after.seasons[0]?.id||'';
 const sliced=sliceState(result.after,workspaceScope(actor,seasonId));
 return Response.json({state:visibleState(sliced,actor),revision:result.committed,seasonId,auditHasMore:sliced.auditHasMore},{headers});
}catch(e){return failure(e);}}
