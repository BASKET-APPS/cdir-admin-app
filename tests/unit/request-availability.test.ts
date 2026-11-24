import {it,expect} from 'vitest';
import {demoState,demoId as id} from '@/domain/seed';
import {requestConflicts} from '@/domain/club-rules';
import type {PlayerRequest} from '@/domain/club-types';

function fixture(start:string,end:string,otherStart:string,otherEnd:string){
 const s=demoState();
 const base={seasonId:id(1),opponent:'Rival',venue:'HOME' as const,location:'Pista',competition:'Liga',status:'SCHEDULED' as const,scoreFor:null,scoreAgainst:null,published:false,isExample:true};
 s.matches=[{...base,id:id(700),teamId:id(11),startsAt:start,endsAt:end},{...base,id:id(701),teamId:id(10),startsAt:otherStart,endsAt:otherEnd}];
 const request:PlayerRequest={id:id(702),seasonId:id(1),teamId:id(11),kind:'MATCH',matchId:id(700),sessionId:null,neededAt:start,requestedBy:'coach',quantity:1,reason:'Refuerzo',recurring:false,status:'PENDING',createdAt:start,resolvedAt:null,decisionNote:''};
 return {s,request};
}
it.each([
 ['sábado y domingo','2026-11-08T17:00:00+01:00','2026-11-08T19:00:00+01:00','2026-11-07T11:00:00+01:00','2026-11-07T13:00:00+01:00'],
 ['domingo a las 11 y a las 17','2026-11-08T17:00:00+01:00','2026-11-08T19:00:00+01:00','2026-11-08T11:00:00+01:00','2026-11-08T13:00:00+01:00'],
 ['más de dos horas entre inicios sin dos horas de descanso','2026-11-08T13:01:00+01:00','2026-11-08T15:00:00+01:00','2026-11-08T11:00:00+01:00','2026-11-08T13:00:00+01:00'],
 ['subida anterior al habitual con margen','2026-11-08T09:00:00+01:00','2026-11-08T11:00:00+01:00','2026-11-08T13:00:00+01:00','2026-11-08T15:00:00+01:00'],
])('permite %s',(_,start,end,otherStart,otherEnd)=>{const {s,request}=fixture(start,end,otherStart,otherEnd);expect(requestConflicts(s,request,id(50))).toEqual([]);});
it.each([
 ['a las 11 y a las 13','2026-11-08T13:00:00+01:00','2026-11-08T15:00:00+01:00','2026-11-08T11:00:00+01:00','2026-11-08T13:00:00+01:00'],
 ['falta un minuto de separación entre inicios','2026-11-08T12:59:00+01:00','2026-11-08T15:00:00+01:00','2026-11-08T11:00:00+01:00','2026-11-08T13:00:00+01:00'],
 ['horarios solapados','2026-11-08T12:00:00+01:00','2026-11-08T14:00:00+01:00','2026-11-08T11:00:00+01:00','2026-11-08T13:00:00+01:00'],
])('bloquea %s',(_,start,end,otherStart,otherEnd)=>{const {s,request}=fixture(start,end,otherStart,otherEnd);expect(requestConflicts(s,request,id(50))).toMatchObject([{overlap:true}]);});
it('aplica el día de Madrid aunque UTC pertenezca al día anterior',()=>{const {s,request}=fixture('2026-11-07T23:30:00Z','2026-11-08T01:00:00Z','2026-11-08T01:30:00Z','2026-11-08T03:00:00Z');expect(requestConflicts(s,request,id(50))).toHaveLength(1);});
it('ignora partidos cancelados y otras temporadas',()=>{const {s,request}=fixture('2026-11-08T13:00:00Z','2026-11-08T15:00:00Z','2026-11-08T12:00:00Z','2026-11-08T14:00:00Z');s.matches[1].status='CANCELLED';expect(requestConflicts(s,request,id(50))).toEqual([]);s.matches[1].status='SCHEDULED';s.matches[1].seasonId=id(2);expect(requestConflicts(s,request,id(50))).toEqual([]);});
it('en entrenamientos comprueba solapamiento sin añadir recuperación de partidos',()=>{const {s,request}=fixture('2026-11-08T13:00:00Z','2026-11-08T15:00:00Z','2026-11-08T11:00:00Z','2026-11-08T13:00:00Z');request.kind='TRAINING';request.matchId=null;request.sessionId=id(100);s.sessions[0].startsAt='2026-11-08T13:30:00Z';s.sessions[0].endsAt='2026-11-08T15:00:00Z';expect(requestConflicts(s,request,id(50))).toEqual([]);s.sessions[0].startsAt='2026-11-08T12:30:00Z';expect(requestConflicts(s,request,id(50))).toHaveLength(1);});
