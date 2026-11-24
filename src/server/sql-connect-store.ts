import 'server-only';
import {getDataConnect} from 'firebase-admin/data-connect';
import type {State} from '@/domain/types';
import {emptyState} from '@/domain/types';
import {entityContract,revisionQuery,workspacePageQuery,workspaceMutation,normalizeWorkspacePage,markOmittedAvatars} from '@/domain/sql-connect';
import {adminApp} from './firebase';
export function sqlConnect(){
 if(process.env.FIREBASE_PROJECT_ID!=='cdir-apps')throw new Error('SQL Connect debe usar el proyecto cdir-apps.');
 return getDataConnect({serviceId:process.env.SQL_CONNECT_SERVICE_ID||'cdir-apps-2-service',location:process.env.SQL_CONNECT_LOCATION||'europe-southwest1'},adminApp());
}
async function revision(){const r=await sqlConnect().executeGraphqlRead<{workspaceRevision:{version:number}|null},undefined>(revisionQuery);if(!r.data.workspaceRevision)throw new Error('Inicializa la base SQL Connect y el primer administrador.');return r.data.workspaceRevision.version;}
// full=true is required by transactions: every field must be present so unchanged rows are detected correctly.
async function snapshot(full:boolean){
 for(let attempt=0;attempt<3;attempt++){
  const version=await revision(),state=emptyState();let offset=0,more=true;
  while(more){const r=await sqlConnect().executeGraphqlRead<Record<string,unknown>,undefined>(workspacePageQuery(offset,500,{omitAvatarPayload:!full}));const page=normalizeWorkspacePage(r.data);more=false;for(const key of Object.keys(entityContract) as (keyof State)[]){(state[key] as unknown[]).push(...page[key]);if(page[key].length===500)more=true;}offset+=500;}
  if(await revision()===version)return {state:full?state:markOmittedAvatars(state),version};
 }
 throw new Error('Hay cambios simultáneos. Vuelve a cargar el panel.');
}
/** Read-only snapshot. Uploaded avatar payloads are omitted (see OMITTED_AVATAR). Never pass it to a mutation. */
export async function readSqlConnectState(){return (await snapshot(false)).state;}
const memberFields='id uid name email role teamIds active',profileFields='id uid googlePhotoUrl avatarVersion avatarSource googleSyncedAt updatedAt';
export async function readSqlConnectIdentity(uid:string,email=''){const data=(await sqlConnect().executeGraphqlRead<Record<string,unknown>,{uid:string;email:string}>(`query Identity($uid: String!, $email: String!) @auth(level: NO_ACCESS) { members(where: {_or: [{uid: {eq: $uid}}, {email: {eq: $email}}]},limit: 2) {${memberFields}} profiles(where: {uid: {eq: $uid}},limit: 1) {${profileFields}} coaches(where: {email: {eq: $email}},limit: 20) {id name email phone qualification} staffFunctions(where: {coach: {email: {eq: $email}}},limit: 100) {id coachId kind active} coachTeams(where: {coach: {email: {eq: $email}}},limit: 500) {id coachId teamId seasonId function} }`,{variables:{uid,email:email.toLowerCase()}})).data;return markOmittedAvatars(normalizeWorkspacePage(data));}
/** Own member and profile including the stored avatar reference. */
export async function readSqlConnectOwnAvatar(uid:string){const data=(await sqlConnect().executeGraphqlRead<Record<string,unknown>,{uid:string}>(`query OwnAvatar($uid: String!) @auth(level: NO_ACCESS) { members(where: {uid: {eq: $uid}},limit: 2) {${memberFields}} profiles(where: {uid: {eq: $uid}},limit: 1) {${profileFields} avatarPath} }`,{variables:{uid}})).data;return normalizeWorkspacePage(data);}
/** Only the rows coachProfile() and the team check of the coach avatar route need. */
export async function readSqlConnectCoachAvatar(coachId:string){
 const dc=sqlConnect(),first=normalizeWorkspacePage((await dc.executeGraphqlRead<Record<string,unknown>,{id:string}>(`query CoachAvatar($id: UUID!) @auth(level: NO_ACCESS) { coaches(where: {id: {eq: $id}},limit: 1) {id name email phone qualification} coachTeams(where: {coachId: {eq: $id}},limit: 500) {id coachId teamId seasonId function} }`,{variables:{id:coachId}})).data);
 const email=first.coaches[0]?.email?.toLowerCase();
 if(!email)return first;
 first.members=normalizeWorkspacePage((await dc.executeGraphqlRead<Record<string,unknown>,{email:string}>('query CoachAvatarMember($email: String!) @auth(level: NO_ACCESS) { members(where: {active: {eq: true}, email: {eq: $email}}, limit: 2) {'+memberFields+'} }',{variables:{email}})).data).members;
 const uids=first.members.map(m=>m.uid);
 if(uids.length)first.profiles=normalizeWorkspacePage((await dc.executeGraphqlRead<Record<string,unknown>,{uids:string[]}>(`query CoachAvatarProfile($uids: [String!]!) @auth(level: NO_ACCESS) { profiles(where: {uid: {in: $uids}},limit: 20) {${profileFields} avatarPath} }`,{variables:{uids}})).data).profiles;
 return first;
}
export type ListSpec={key:keyof State;where?:string;fields?:string[];/** GraphQL orderBy value; default {id: ASC} */orderBy?:string;/** stop after this many rows */max?:number};
const NO_MATCH='00000000-0000-0000-0000-000000000000';
export type Vars={definitions:string;values:Record<string,unknown>};
/** Narrow, paginated reads of selected tables. Tables that fill a page are re-queried alone. */
export async function readSqlConnectLists(specs:ListSpec[],variables?:Vars,limit=500){
 const state=emptyState(),contract=entityContract as Record<string,{plural:string;fields:Record<string,string>}>;let pending=specs.map(spec=>({...spec,offset:0}));
 while(pending.length){
  const size=(p:typeof pending[number])=>Math.min(limit,p.max===undefined?limit:p.max-p.offset);
  const body=pending.map(p=>`${p.key}: ${contract[p.key].plural}(${p.where?'where: '+p.where+', ':''}limit: ${size(p)}, offset: ${p.offset}, orderBy: ${p.orderBy||'{id: ASC}'}) { ${(p.fields||Object.keys(contract[p.key].fields)).join(' ')} }`).join('\n');
  const used=variables&&Object.keys(variables.values).some(k=>body.includes('$'+k));
  // `in: []` is not portable: an empty list becomes a nil UUID that never matches any row.
  if(used)for(const [k,v] of Object.entries(variables!.values))if(Array.isArray(v)&&!v.length)variables!.values[k]=[NO_MATCH];
  const r=await sqlConnect().executeGraphqlRead<Record<string,unknown>,Record<string,unknown>>(`query PublicSlice${used?'('+variables!.definitions.split(',').map(x=>x.trim()).filter(d=>body.includes(d.split(':')[0])).join(', ')+')':''} @auth(level: NO_ACCESS) { ${body} }`,used?{variables:Object.fromEntries(Object.entries(variables!.values).filter(([k])=>body.includes('$'+k)))}:undefined);
  const page=normalizeWorkspacePage(r.data);
  pending=pending.filter(p=>{const rows=page[p.key] as unknown[],want=size(p);(state[p.key] as unknown[]).push(...rows);if(rows.length===want&&want>0&&(p.max===undefined||p.offset+want<p.max)){p.offset+=want;return true;}return false;});
 }
 return state;
}
/** Same as readSqlConnectLists but consistent: the revision must not change while the rows are read. */
export async function readConsistentLists(specs:ListSpec[],variables?:Vars){
 for(let attempt=0;attempt<3;attempt++){const version=await revision(),state=await readSqlConnectLists(specs,variables);if(await revision()===version)return {state,version};}
 throw new Error('Hay cambios simultáneos. Vuelve a cargar el panel.');
}
export {revision as sqlConnectRevision};
/** Full snapshot with every field, for transactions that are not scoped. */
export async function fullSqlConnectSnapshot(){return snapshot(true);}
export async function sqlConnectTransaction<T>(fn:(s:State)=>T|Promise<T>):Promise<T>{
 const {state,version}=await snapshot(true),before=structuredClone(state),result=await fn(state),mutation=workspaceMutation(before,state,version);
 if(mutation){try{await sqlConnect().executeGraphql(mutation.query,{variables:mutation.variables});}catch(e){if(String(e).includes('CDIR_CONCURRENT_CHANGE'))throw new Error('Otra persona ha guardado cambios. Recarga y vuelve a intentarlo.');throw e;}}
 return result;
}
