import {clientAuth} from './client-auth';
import {browserQuery,browserPublicFeed,browserMagazine} from './browser-sql';
import {emptyState,type State,type Identity} from '@/domain/types';
import {normalizeWorkspacePage} from '@/domain/sql-connect';
import {coachIdentity} from '@/domain/people';
import {visibleState} from '@/domain/permissions';
import {physicalCalendarStatus} from '@/domain/calendar-status';
let current:State|null=null;
async function access(){const a=clientAuth();await a.authStateReady();const google=a.currentUser;if(!google)throw Error('Inicia sesión para continuar.');const token=await google.getIdToken();const raw=await browserQuery<Record<string,unknown>>('BrowserIdentity',{},token);const state=normalizeWorkspacePage(raw),member=state.members[0];if(!member)throw Error('Tu cuenta no tiene acceso al club.');return {token,state,user:{...coachIdentity(state,member),avatarUrl:google.photoURL||null,googlePhotoUrl:google.photoURL||null} as Identity};}
async function workspace(wanted:string|null){const {token,state,user}=await access(),seasonId=wanted||state.seasons.find(s=>s.current)?.id||state.seasons[0]?.id||'';
 if(!['ADMIN','COACH'].includes(user.role))throw Error('La conexión directa de este perfil todavía no está disponible.');
 const out=emptyState(),teamIds=user.role==='ADMIN'?['']:state.coachTeams.filter(c=>c.seasonId===seasonId&&c.function!=='FORMER').map(c=>c.teamId);
 for(const teamId of [...new Set(teamIds)])for(let offset=0;;offset+=300){const raw=await browserQuery<Record<string,unknown>> (user.role==='ADMIN'?'BrowserAdminPage':'BrowserCoachPage',{seasonId,offset,...(teamId?{teamId}:{})},token);const page=normalizeWorkspacePage(raw);
 if(user.role==='COACH'){for(const p of (raw.playerSeasons||[]) as {player:State['players'][number]}[])if(p.player)page.players.push({...p.player,email:'',phone:''});for(const c of (raw.coachTeams||[]) as {coach:State['coaches'][number]}[])if(c.coach)page.coaches.push({...c.coach,email:'',phone:''});}
 for(const k of Object.keys(out) as (keyof State)[]){const have=new Set(out[k].map(x=>x.id));(out[k] as {id:string}[]).push(...page[k].filter(x=>!have.has(x.id)));}if(!Object.values(page).some(a=>a.length===300))break;}
 out.profiles=state.profiles;current=out;return {mode:'firebase',user,state:visibleState(out,user),seasonId,revision:null,auditHasMore:false};}
const json=(value:unknown,status=200)=>Response.json(value,{status});
export async function browserApi(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin);if(!u.pathname.startsWith('/api/'))return globalThis.fetch(input,init);try{
 const method=init?.method||'GET';
 if(u.pathname==='/api/session'){if(method==='DELETE')return json({mode:'firebase',user:null});const a=clientAuth();await a.authStateReady();return json({mode:'firebase',user:a.currentUser?{uid:a.currentUser.uid}:null});}
 if(u.pathname==='/api/workspace'&&method==='GET')return json(await workspace(u.searchParams.get('seasonId')));
 if(u.pathname==='/api/profile'&&method==='POST'){const body=typeof init?.body==='string'?JSON.parse(init.body):{};if(body.action==='syncGoogle')return json({user:(await access()).user});}
 if(u.pathname==='/api/calendar-status')return json(physicalCalendarStatus(current?.supportSessions||[],u.searchParams.get('seasonId')||''));
 if(u.pathname==='/api/audit')return json({rows:[],hasMore:false});
 if(u.pathname==='/api/public/club')return json(await browserPublicFeed());
 const pdf=u.pathname.match(/^\/api\/public\/magazines\/([^/]+)\/(cover|pdf)$/);if(pdf){let token:string|undefined;const a=clientAuth();await a.authStateReady();if(a.currentUser)token=await a.currentUser.getIdToken();return browserMagazine(pdf[1],pdf[2]==='cover',token);}
 throw Error('Esta operación aún necesita adaptarse a la conexión directa. No se han guardado cambios.');
 }catch(e){const message=e instanceof Error?e.message:'No se ha podido consultar Firebase.';return json({message},/Inicia sesión/.test(message)?401:/acceso/.test(message)?403:400);}}
