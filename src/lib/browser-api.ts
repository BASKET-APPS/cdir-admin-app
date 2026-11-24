import {clientAuth} from './client-auth';
import {browserQuery,browserMutation,browserPublicFeed,browserMagazine} from './browser-sql';
import {memberVariables} from '@/domain/browser-member';
import {emptyState,type State,type Identity} from '@/domain/types';
import {normalizeWorkspacePage} from '@/domain/sql-connect';
import {coachIdentity} from '@/domain/people';
import {visibleState} from '@/domain/permissions';
import {physicalCalendarStatus} from '@/domain/calendar-status';
let current:State|null=null,currentRevision:number|null=null;
async function access(){const a=clientAuth();await a.authStateReady();const google=a.currentUser;if(!google)throw Error('Inicia sesión para continuar.');const token=await google.getIdToken();let raw:Record<string,unknown>;
 try{raw=await browserQuery<Record<string,unknown>>('BrowserIdentity',{},token);}catch(e){if((e as {code?:string}).code!=='CDIR_ACCESS_REQUIRED')throw e;
 const invited=await browserQuery<{members:{id:string;uid:string}[];workspaceRevision:{version:number}}>('BrowserInvitation',{},token),pending=invited.members.find(m=>m.uid.startsWith('invite:'));if(!pending)throw Error('Tu cuenta no tiene acceso al club.');const version=invited.workspaceRevision.version;
 await browserMutation('BrowserAcceptInvitation',{memberId:pending.id,version,next:version+1},token);raw=await browserQuery('BrowserIdentity',{},token);}
 const state=normalizeWorkspacePage(raw),member=state.members[0];if(!member)throw Error('Tu cuenta no tiene acceso al club.');return {token,state,user:{...coachIdentity(state,member),avatarUrl:google.photoURL||null,googlePhotoUrl:google.photoURL||null} as Identity};}
async function workspace(wanted:string|null){const {token,state,user}=await access(),seasonId=wanted||state.seasons.find(s=>s.current)?.id||state.seasons[0]?.id||'';
 if(!['ADMIN','COACH'].includes(user.role))throw Error('La conexión directa de este perfil todavía no está disponible.');
 const out=emptyState(),teamIds=user.role==='ADMIN'?['']:state.coachTeams.filter(c=>c.seasonId===seasonId&&c.function!=='FORMER').map(c=>c.teamId);let revision:number|null=null;
 if(user.role==='COACH'){out.seasons=state.seasons;out.coaches=state.coaches;out.coachTeams=state.coachTeams.filter(c=>c.seasonId===seasonId);out.staffFunctions=state.staffFunctions;}
 for(const teamId of [...new Set(teamIds)])for(let offset=0;;offset+=300){const raw=await browserQuery<Record<string,unknown>> (user.role==='ADMIN'?'BrowserAdminPage':'BrowserCoachPage',{seasonId,offset,...(teamId?{teamId}:{})},token);const page=normalizeWorkspacePage(raw);
 if(user.role==='ADMIN'){const next=(raw.workspaceRevision as {version:number})?.version;if(!Number.isInteger(next)||revision!==null&&revision!==next)throw Error('Los datos han cambiado durante la carga. Vuelve a cargar la página.');revision=next;}
 if(user.role==='COACH'){for(const p of (raw.playerSeasons||[]) as {player:State['players'][number]}[])if(p.player)page.players.push({...p.player,email:'',phone:''});for(const c of (raw.coachTeams||[]) as {coach:State['coaches'][number]}[])if(c.coach)page.coaches.push({...c.coach,email:'',phone:''});}
 for(const k of Object.keys(out) as (keyof State)[]){const have=new Set(out[k].map(x=>x.id));(out[k] as {id:string}[]).push(...page[k].filter(x=>!have.has(x.id)));}if(!Object.values(page).some(a=>a.length===300))break;}
 out.profiles=state.profiles;current=out;currentRevision=revision;return {mode:'firebase',user,state:visibleState(out,user),seasonId,revision,auditHasMore:false};}
const json=(value:unknown,status=200)=>Response.json(value,{status});
export async function browserApi(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin);if(!u.pathname.startsWith('/api/'))return globalThis.fetch(input,init);try{
 const method=init?.method||'GET';
 if(u.pathname==='/api/session'){if(method==='DELETE'){current=null;currentRevision=null;return json({mode:'firebase',user:null});}const a=clientAuth();await a.authStateReady();return json({mode:'firebase',user:a.currentUser?{uid:a.currentUser.uid}:null});}
 if(u.pathname==='/api/workspace'&&method==='GET')return json(await workspace(u.searchParams.get('seasonId')));
 if(u.pathname==='/api/workspace'&&method==='POST'){const body=typeof init?.body==='string'?JSON.parse(init.body):{};if(body.action==='memberByEmail'){const {token,user}=await access();if(!current||currentRevision===null)throw Object.assign(Error('Recarga la página antes de autorizar la cuenta.'),{status:409});const variables=await memberVariables(current,user,body.payload,currentRevision);await browserMutation('BrowserAuthorizeMember',variables,token);return json(await workspace(typeof body.seasonId==='string'?body.seasonId:null));}}
 if(u.pathname==='/api/workspace'&&method==='POST'){const body=typeof init?.body==='string'?JSON.parse(init.body):{};if(body.action==='disableMember'){const {token,user}=await access();if(user.role!=='ADMIN')throw Error('Solo administración puede gestionar accesos.');const target=current?.members.find(m=>m.id===body.payload?.id);if(!target||currentRevision===null)throw Object.assign(Error('Recarga la página antes de cambiar el acceso.'),{status:409});if(target.uid===user.uid)throw Error('No puedes desactivar tu propia cuenta.');await browserMutation('BrowserSetMemberActive',{memberId:target.id,active:!target.active,version:currentRevision,next:currentRevision+1},token);return json(await workspace(typeof body.seasonId==='string'?body.seasonId:null));}}
 if(u.pathname==='/api/profile'&&method==='POST'){const body=typeof init?.body==='string'?JSON.parse(init.body):{};if(body.action==='syncGoogle')return json({user:(await access()).user});}
 if(u.pathname==='/api/calendar-status')return json(physicalCalendarStatus(current?.supportSessions||[],u.searchParams.get('seasonId')||''));
 if(u.pathname==='/api/audit')return json({rows:[],hasMore:false});
 if(u.pathname==='/api/public/club')return json(await browserPublicFeed());
 const pdf=u.pathname.match(/^\/api\/public\/magazines\/([^/]+)\/(cover|pdf)$/);if(pdf){let token:string|undefined;const a=clientAuth();await a.authStateReady();if(a.currentUser)token=await a.currentUser.getIdToken();return browserMagazine(pdf[1],pdf[2]==='cover',token);}
 throw Error('Esta operación aún necesita adaptarse a la conexión directa. No se han guardado cambios.');
 }catch(e){const message=e instanceof Error?e.message:'No se ha podido consultar Firebase.';return json({message},(e as {status?:number}).status===409?409:/Inicia sesión/.test(message)?401:/acceso/.test(message)?403:400);}}
