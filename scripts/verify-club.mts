import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getDataConnect} from 'firebase-admin/data-connect';
import {emptyState,type State} from '../src/domain/types';
import {normalizeWorkspacePage,workspacePageQuery} from '../src/domain/sql-connect';
import {strict as assert} from 'node:assert';
import {writeFile} from 'node:fs/promises';
const app=initializeApp({credential:applicationDefault(),projectId:'cdir-apps'}),dc=getDataConnect({serviceId:'cdir-apps-2-service',location:'europe-southwest1',connector:'cdir-admin'},app),s=emptyState();let offset=0;
while(true){const page=normalizeWorkspacePage((await dc.executeGraphqlRead<Record<string,unknown>,undefined>(workspacePageQuery(offset))).data);for(const key of Object.keys(page) as (keyof State)[])(s[key] as unknown[]).push(...page[key]);if(!Object.values(page).some(rows=>rows.length===500))break;offset+=500;}
const seasons=s.seasons.filter(x=>['2024 / 2025','2025 / 2026','2026 / 2027'].includes(x.name));assert.equal(seasons.length,3);
const seasonCounts=seasons.map(season=>{const teams=s.teams.filter(t=>t.seasonId===season.id);assert.equal(teams.filter(t=>t.branch==='Femenino').length,8);assert.equal(teams.filter(t=>t.branch==='Masculino').length,10);for(const t of teams){assert.equal(s.coachTeams.filter(c=>c.teamId===t.id&&c.function==='HEAD').length,1);assert(s.coachTeams.filter(c=>c.teamId===t.id&&c.function==='ASSISTANT').length<=1);}return {season:season.name,teams:teams.length};});
const current=s.seasons.find(x=>x.current)!,senior=s.teams.find(t=>t.seasonId===current.id&&t.name==='Sénior masculino A')!,roster=s.playerSeasons.filter(p=>p.teamId===senior.id);
assert.equal(roster.length,11);assert(roster.every(p=>s.playerDetails.find(d=>d.playerId===p.playerId)?.photoUrl.startsWith('data:image/webp;base64,')));assert(roster.every(p=>s.guardianLinks.some(l=>l.playerId===p.playerId&&l.seasonId===current.id&&l.relationship==='Propio responsable')));
assert(s.guardians.some(g=>new Set(s.guardianLinks.filter(l=>l.guardianId===g.id).map(l=>l.playerId)).size>1));
assert(s.playerRequests.some(r=>r.recurring&&r.status==='APPROVED'));assert(s.requestPlayers.length>=4);assert.equal(s.magazines.filter(m=>m.published).length,4);
let denied=false;try{await dc.executeQuery('AdminConnectionCheck',{}, {impersonate:{unauthenticated:true}});}catch{denied=true;}assert(denied,'El conector administrativo debe rechazar clientes sin privilegios.');
const report={verifiedAt:new Date().toISOString(),seasons:seasonCounts,counts:Object.fromEntries(Object.entries(s).map(([key,rows])=>[key,rows.length])),seniorPlayers:roster.length,seniorPhotos:11,privateConnectorDeniedAnonymous:true};await writeFile('.local/club-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
