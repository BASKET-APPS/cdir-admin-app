import type {State,Identity,PublicState} from './types';

export function coachIdentity<T extends Identity>(s:Pick<State,'coaches'|'coachTeams'|'staffFunctions'>,user:T):T{
 const coaches=new Set(s.coaches.filter(c=>c.email.toLowerCase()===user.email.toLowerCase()).map(c=>c.id));
 const rows=s.staffFunctions.filter(f=>coaches.has(f.coachId));
 const functions=rows.length?rows.filter(f=>f.active).map(f=>f.kind):['COACH' as const];
 return {...user,staffCoachIds:[...coaches],staffFunctions:functions,teamIds:user.role==='COACH'?(functions.includes('COACH')?[...new Set(s.coachTeams.filter(a=>coaches.has(a.coachId)&&a.function!=='FORMER').map(a=>a.teamId))]:[]):user.teamIds};
}

// El perfil deportivo es independiente del permiso de acceso a la aplicación.
export function ensureCoach(s:State,user:Pick<Identity,'email'|'name'|'role'>){
 if(!['ADMIN','COACH'].includes(user.role)||!user.email)return null;
 let coach=s.coaches.find(c=>c.email.toLowerCase()===user.email.toLowerCase());
 if(!coach){coach={id:crypto.randomUUID(),name:user.name,email:user.email,phone:'',qualification:''};s.coaches.push(coach);s.coachDetails.push({id:crypto.randomUUID(),coachId:coach.id,photoUrl:'',isExample:false});}
 return coach;
}
export function familyGroups(s:Pick<PublicState,'guardians'|'guardianLinks'|'players'|'playerSeasons'>,seasonId:string){
 const links=s.guardianLinks.filter(l=>l.seasonId===seasonId),seen=new Set<string>();
 return s.guardians.filter(g=>links.some(l=>l.guardianId===g.id)||!s.guardianLinks.some(l=>l.guardianId===g.id)).flatMap(g=>{if(seen.has(g.id))return [];const ids=new Set([g.id]),children=new Set<string>();let changed=true;while(changed){changed=false;for(const l of links){if(ids.has(l.guardianId)&&!children.has(l.playerId)){children.add(l.playerId);changed=true;}if(children.has(l.playerId)&&!ids.has(l.guardianId)){ids.add(l.guardianId);changed=true;}}}for(const id of ids)seen.add(id);const players=s.players.filter(p=>children.has(p.id)),responsibles=s.guardians.filter(p=>ids.has(p.id)),self=links.filter(l=>ids.has(l.guardianId)).every(l=>l.relationship==='Propio responsable')&&players.length>0;const surname=players[0]?.name.split(' ').slice(-2).join(' ');return [{id:g.id,title:self?players[0].name:surname?'Familia '+surname:'Familia de '+g.name,responsibles,players,self}];});
}
