// La lectura acotada debe mostrar a cada perfil exactamente lo mismo que antes, limitado a la temporada
// elegida (y a las últimas notificaciones/auditoría). Compara: (1) reglas en memoria contra la vista
// completa anterior y (2) filtros GraphQL ejecutados en el SIMULADOR contra las reglas en memoria.
import {it,expect,vi,beforeAll,afterAll,describe} from 'vitest';
import {syntheticClub,REFERENCE_NOW,people} from '../support/synthetic-club';
import {FakeSqlConnect} from '../support/fake-sql-connect';
import {getReq,setupEnv} from '../support/api';
import {visibleState} from '@/domain/permissions';
import {coachIdentity} from '@/domain/people';
import {sliceState,workspaceScope,scopedRules,indexOf,NOTIFICATION_LIMIT,AUDIT_PAGE} from '@/domain/scope';
import type {State,Member} from '@/domain/types';
const g=vi.hoisted(()=>({dc:null as unknown}));
vi.mock('firebase-admin/data-connect',()=>({getDataConnect:()=>g.dc}));
vi.mock('@/server/firebase',()=>({adminApp:()=>({}),storageBucket:()=>({}),serverAuth:()=>({verifyIdToken:async(token:string)=>{const [uid,email]=token.split('|');return {uid,email,email_verified:true,firebase:{sign_in_provider:'google.com'}};},getUser:async()=>({providerData:[]})})}));
import {GET} from '@/app/api/workspace/route';
beforeAll(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(REFERENCE_NOW);setupEnv();});
afterAll(()=>vi.useRealTimers());
const base=syntheticClub(),who=people(base);
const physical=base.members.find(m=>base.coaches.some(c=>c.email===m.email&&base.staffFunctions.some(f=>f.coachId===c.id&&f.kind==='PHYSICAL')))!;
const psychologist=base.members.find(m=>base.coaches.some(c=>c.email===m.email&&base.staffFunctions.some(f=>f.coachId===c.id&&f.kind==='PSYCHOLOGY')))!;
const users:[string,Member][]=[['administración',who.admin],['entrenador',who.coachMember(0)],['entrenador (otro)',who.coachMember(3)],['preparación física',physical],['psicología',psychologist]];
const DERIVED=new Set(['teams','playerSeasons','players','playerDetails']);
const sortById=(rows:{id:string}[])=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
describe('reglas en memoria = vista completa anterior limitada a la temporada',()=>{
 for(const season of base.seasons)for(const [label,member] of users)it(`${label} · ${season.name}`,()=>{
  const u=coachIdentity(base,member),full=visibleState(base,u) as unknown as Record<string,{id:string}[]>,scope=workspaceScope(u,season.id),sliced=visibleState(sliceState(base,scope),u) as unknown as Record<string,{id:string}[]>;
  const ix=indexOf(base),seasonOnly=workspaceScope({...u,role:'ADMIN'},season.id);
  for(const key of Object.keys(full) as (keyof State)[]){
   const rule=scopedRules[key];let want=full[key];
   if(rule&&key!=='notifications'&&key!=='audit')want=want.filter(r=>scopedRules[key]!(r as never,{...seasonOnly,uid:u.uid},ix));
   if(key==='notifications')want=[...want].sort((a,b)=>(b as never as {createdAt:string}).createdAt.localeCompare((a as never as {createdAt:string}).createdAt)||b.id.localeCompare(a.id)).slice(0,NOTIFICATION_LIMIT);
   if(key==='audit')want=[...want].sort((a,b)=>(b as never as {at:string}).at.localeCompare((a as never as {at:string}).at)||b.id.localeCompare(a.id)).slice(0,AUDIT_PAGE);
   // Catalogues a coach reaches through other seasons' sessions or requests are derived: the season view
   // keeps a subset, which must still contain every row referenced by the season's own rows.
   if(DERIVED.has(key)&&u.role==='COACH'){const ids=new Set(full[key].map(r=>r.id));for(const r of sliced[key])expect(ids.has(r.id),key).toBe(true);continue;}
   expect(sortById(sliced[key]),key).toEqual(sortById(want));
  }
  const v=sliced as unknown as State,teams=new Set(v.teams.map(t=>t.id)),ps=new Set(v.playerSeasons.map(p=>p.id)),players=new Set(v.players.map(p=>p.id));
  for(const x of [...v.sessions,...v.matches])expect(teams.has(x.teamId)).toBe(true);
  for(const x of [...v.attendance,...v.crossTrainings,...v.requestPlayers,...v.supportParticipants])expect(ps.has(x.playerSeasonId)).toBe(true);
  for(const p of v.playerSeasons)expect(players.has(p.playerId)).toBe(true);
 });
});
describe('filtros SQL Connect (simulador) = reglas en memoria',()=>{
 for(const [label,member] of users)it(label,async()=>{const dc=new FakeSqlConnect(structuredClone(base));g.dc=dc;
  const r=await GET(getReq('/api/workspace',member));const body=await r.json();expect(r.status).toBe(200);
  const s=dc.state(),u=coachIdentity(s,s.members.find(m=>m.uid===member.uid)!);const want=visibleState(sliceState(s,workspaceScope(u,body.seasonId)),u) as unknown as Record<string,{id:string}[]>;
  for(const key of Object.keys(want))if(Array.isArray(want[key]))expect(sortById(body.state[key]),key).toEqual(sortById(want[key]));
 });
});
