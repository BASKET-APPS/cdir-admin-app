import contract from '@/generated/sql-connect-contract.json';
import {emptyState,type State} from './types';
export const entityContract=contract;
export const revisionQuery='query Revision @auth(level: NO_ACCESS) { workspaceRevision(key: {id: "club"}) { version } }';
// Read-only snapshots never transfer uploaded avatar bytes. Uploads always set avatarPath and
// avatarVersion together, so the version keeps the "has uploaded avatar" signal without the payload.
export const OMITTED_AVATAR='omitted:avatar';
export type PageOptions={omitAvatarPayload?:boolean};
export function workspacePageQuery(offset:number,limit=500,options:PageOptions={}){
 return 'query AdminWorkspace @auth(level: NO_ACCESS) { '+Object.entries(contract).map(([key,c])=>`${key}: ${c.plural}(limit: ${limit}, offset: ${offset}, orderBy: {id: ASC}) { ${Object.keys(c.fields).filter(f=>!(options.omitAvatarPayload&&key==='profiles'&&f==='avatarPath')).join(' ')} }`).join('\n')+' }';
}
export function markOmittedAvatars(state:State){for(const p of state.profiles)p.avatarPath=p.avatarVersion?OMITTED_AVATAR:null;return state;}
export function changedRows(before:State,after:State){
 return Object.entries(contract).flatMap(([key,c])=>{
  const k=key as keyof State,old=new Map(before[k].map(r=>[r.id,r]));
  const kept=new Set(after[k].map(a=>a.id));if(before[k].some(r=>!kept.has(r.id)))throw new Error('Las bajas deben conservar el histórico.');
  return after[k].filter(r=>JSON.stringify(old.get(r.id))!==JSON.stringify(r)).map(row=>{
   if(k==='audit'&&old.has(row.id))throw new Error('La auditoría no se puede modificar.');
   if(k==='profiles'&&(row as {avatarPath?:unknown}).avatarPath===OMITTED_AVATAR)throw new Error('No se pueden guardar perfiles leídos sin su imagen.');
   const raw=row as unknown as Record<string,unknown>;
   return {key:k,contract:c,row:Object.fromEntries(Object.keys(c.fields).map(f=>[f,raw[f]??null]))};
  });
 });
}
export function workspaceMutation(before:State,after:State,version:number){
 const changes=changedRows(before,after).sort((a,b)=>a.key==='seasons'&&b.key==='seasons'?Number(!!a.row.current)-Number(!!b.row.current):0);if(!changes.length)return null;
 const vars:Record<string,unknown>={version,next:version+1};
 const definitions=['$version: Int!','$next: Int!'];
 const fields=['lock: workspaceRevision_updateMany(where: {id: {eq: "club"}, version: {eq: $version}}, data: {version: $next}) @check(expr: "this == 1", message: "CDIR_CONCURRENT_CHANGE")'];
 if(before.seasons.find(s=>s.current)?.id!==after.seasons.find(s=>s.current)?.id)fields.push('clearCurrent: season_updateMany(where: {current: {eq: true}}, data: {current: false})');
 const groups=new Map<string,typeof changes>();for(const change of changes){const group=groups.get(change.key)||[];group.push(change);groups.set(change.key,group);}
 let i=0;for(const [key,rows] of groups){const c=rows[0].contract;if(key==='coachTeams')rows.sort((a,b)=>Number(a.row.function!=='FORMER')-Number(b.row.function!=='FORMER'));for(let offset=0;offset<rows.length;offset+=100){const v='r'+i++;definitions.push('$'+v+': ['+c.type+'_Data!]!');vars[v]=rows.slice(offset,offset+100).map(r=>r.row);fields.push(`${v}: ${c.singular}_${key==='audit'?'insertMany':'upsertMany'}(data: $${v})`);}}


 return {query:`mutation SaveWorkspace(${definitions.join(',')}) @auth(level: NO_ACCESS) @transaction { ${fields.join('\n')} }`,variables:vars};
}
export function normalizeUuid(value:unknown):unknown{if(typeof value!=='string')return value;const h=value.replaceAll('-','');return /^[0-9a-f]{32}$/i.test(h)?h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20):value;}
export function normalizeWorkspacePage(data:Record<string,unknown>){const state=emptyState();for(const [key,c] of Object.entries(contract)){const rows=(data[key]??[]) as Record<string,unknown>[];state[key as keyof State]=rows.map(row=>Object.fromEntries(Object.entries(row).map(([field,value])=>{const type=(c.fields as Record<string,string>)[field]||'';return [field,type.startsWith('Timestamp')&&typeof value==='string'?new Date(value).toISOString():type.startsWith('UUID')?normalizeUuid(value):type.startsWith('[UUID')&&Array.isArray(value)?value.map(normalizeUuid):value];}))) as never;}return state;}

