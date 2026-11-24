import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getDataConnect} from 'firebase-admin/data-connect';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,randomBytes,createCipheriv} from 'node:crypto';
import {emptyState,type State,type Identity} from '../src/domain/types';
import {normalizeWorkspacePage,workspacePageQuery,workspaceMutation} from '../src/domain/sql-connect';
import {executeClub} from '../src/domain/club-operations';
const app=initializeApp({credential:applicationDefault(),projectId:'cdir-apps'}),dc=getDataConnect({serviceId:'cdir-apps-2-service',location:'europe-southwest1'},app),before=emptyState();let offset=0;
while(true){const page=normalizeWorkspacePage((await dc.executeGraphqlRead<Record<string,unknown>,undefined>(workspacePageQuery(offset))).data);for(const key of Object.keys(page) as (keyof State)[])(before[key] as unknown[]).push(...page[key]);if(!Object.values(page).some(rows=>rows.length===500))break;offset+=500;}
const next=structuredClone(before),season=next.seasons.find(s=>s.current)!,destination=next.teams.find(t=>t.seasonId===season.id&&t.name==='Cadete 2.º año masculino A')!,source=next.teams.find(t=>t.seasonId===season.id&&t.name==='Cadete 2.º año masculino B')!;
const players=next.playerSeasons.filter(p=>p.teamId===source.id).slice(0,2),admin:Identity={uid:'example-data-loader',name:'Carga de ejemplos',email:'examples@example.invalid',role:'ADMIN',teamIds:[],active:true};
for(const kind of ['TRAINING','MATCH'] as const){const reason='Ejemplo aprobado · '+kind;if(next.playerRequests.some(r=>r.reason===reason))continue;const session=next.sessions.find(s=>s.teamId===destination.id&&s.status==='SCHEDULED'&&new Date(s.startsAt)>new Date())!,match=next.matches.find(m=>m.teamId===destination.id&&m.status==='SCHEDULED'&&new Date(m.startsAt)>new Date())!;
 executeClub(next,admin,'requestPlayers',{teamId:destination.id,kind,sessionId:kind==='TRAINING'?session.id:null,matchId:kind==='MATCH'?match.id:null,quantity:2,reason,recurring:kind==='TRAINING'});const r=next.playerRequests.at(-1)!;
 executeClub(next,admin,'resolveRequest',{id:r.id,status:'APPROVED',playerSeasonIds:players.map(p=>p.id),note:'Ejemplo: coordinación ha revisado los partidos de la semana y las horas de ambos equipos.',allowWeekendConflict:true});
}
let secret=process.env.BANK_ENCRYPTION_KEY;if(!secret){secret=randomBytes(32).toString('base64');await writeFile('.env.local',(await readFile('.env.local','utf8'))+'\nBANK_ENCRYPTION_KEY='+secret+'\n');}
const encrypt=(value:string)=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(secret!,'base64'),iv),body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),body].map(b=>b.toString('base64')).join('.');};
for(const ps of next.playerSeasons.filter(p=>p.seasonId===season.id&&next.playerDetails.find(d=>d.playerId===p.playerId)?.isExample).slice(0,8)){if(next.bankAccounts.some(a=>a.playerSeasonId===ps.id))continue;next.bankAccounts.push({id:randomUUID(),playerSeasonId:ps.id,holder:'Titular de ejemplo · SIN AUTORIZACIÓN REAL',holderDocument:encrypt('DOCUMENTO-EJEMPLO'),ibanEncrypted:encrypt('ES9121000418450200051332'),last4:'1332',mandateReference:'DEMO-'+ps.id.slice(0,12),mandateDate:'2026-10-01'});}
const version=(await dc.executeGraphqlRead<{workspaceRevision:{version:number}},undefined>('query R @auth(level: NO_ACCESS) {workspaceRevision(key: {id: "club"}) {version}}')).data.workspaceRevision.version;const mutation=workspaceMutation(before,next,version);if(mutation)await dc.executeGraphql(mutation.query,{variables:mutation.variables});console.log('Ejemplos de subidas aprobadas, entrenamientos continuados y ocho cuentas de prueba cifradas añadidos. Ningún cargo realizado.');
