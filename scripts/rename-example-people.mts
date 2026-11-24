import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getDataConnect} from 'firebase-admin/data-connect';
import {randomUUID} from 'node:crypto';
import {emptyState,type State} from '../src/domain/types';
import {revisionQuery,workspacePageQuery,normalizeWorkspacePage,workspaceMutation} from '../src/domain/sql-connect';

if(process.env.FIREBASE_PROJECT_ID!=='cdir-apps')throw new Error('Proyecto inesperado');
const dc=getDataConnect({serviceId:'cdir-apps-2-service',location:'europe-southwest1'},initializeApp({credential:applicationDefault(),projectId:'cdir-apps'}));
const version=async()=>(await dc.executeGraphqlRead<{workspaceRevision:{version:number}},undefined>(revisionQuery)).data.workspaceRevision.version;
const revision=await version(),before=emptyState();
for(let offset=0;;offset+=500){const page=normalizeWorkspacePage((await dc.executeGraphqlRead<Record<string,unknown>,undefined>(workspacePageQuery(offset))).data);for(const k of Object.keys(page) as (keyof State)[])(before[k] as unknown[]).push(...page[k]);if(!Object.values(page).some(rows=>rows.length===500))break;}
if(await version()!==revision)throw new Error('Cambios simultáneos; vuelve a ejecutar');
const next=structuredClone(before),surnames=['García','Fernández','Ruiz','Pérez','Gil','López','Torres','Vega','Santos','Díaz','Martín','Sánchez','Romero','Navarro','Serrano','Molina','Ortega','Jiménez','Moreno','Castro','Alonso','Herrera','Delgado','Ramos','Muñoz','Cabrera','Vargas','Iglesias','Medina','Cortés'];
const full=(first:string,i:number)=>`${first} ${surnames[i%surnames.length]} ${surnames[(i*7+11)%surnames.length]}`;
let players=0,guardians=0,coaches=0;
for(const [i,p] of next.players.entries()){if(!next.playerDetails.some(d=>d.playerId===p.id&&d.isExample)||!p.name.includes('Ejemplo'))continue;p.name=full(p.name.split(' ')[0],i);players++;}
for(const [i,g] of next.guardians.entries()){if(!g.name.includes('Ejemplo'))continue;const link=next.guardianLinks.find(l=>l.guardianId===g.id),detail=next.playerDetails.find(d=>d.playerId===link?.playerId);const player=next.players.find(p=>p.id===link?.playerId);if(detail?.selfResponsible&&player)g.name=player.name;else g.name=full(['María','Javier','Ana','Carlos','Laura','Sergio','Isabel','David'][i%8],i+5);guardians++;}
for(const [i,c] of next.coaches.entries()){if(!next.coachDetails.some(d=>d.coachId===c.id&&d.isExample)||!c.name.includes('Ejemplo'))continue;c.name=full(c.name.split(' ')[0],i+8);coaches++;}
for(const a of next.applications)if(a.name==='Participante Ejemplo')a.name='Marcos Sánchez Romero';
if(players+guardians+coaches||!next.audit.some(a=>a.action==='examples.rename')){next.audit.push({id:randomUUID(),at:new Date().toISOString(),actor:'Administración CDIR',actorUid:'example-data-loader',action:'examples.rename',detail:`Nombres completos para datos ficticios: jugadores, responsables y entrenadores de ejemplo actualizados.`});}
const mutation=workspaceMutation(before,next,revision);if(mutation&&process.argv.includes('--apply')){let current=structuredClone(before),v=revision;for(const key of ['players','guardians','coaches','applications','audit'] as const){const changed=next[key].filter(row=>JSON.stringify(before[key].find(old=>old.id===row.id))!==JSON.stringify(row));for(let i=0;i<changed.length;i+=60){const batch=structuredClone(current);for(const row of changed.slice(i,i+60)){const rows=batch[key] as {id:string}[],index=rows.findIndex(old=>old.id===row.id);if(index<0)rows.push(row);else rows[index]=row;}const write=workspaceMutation(current,batch,v);if(write){await dc.executeGraphql(write.query,{variables:write.variables});v++;current=batch;}}}}
console.log(JSON.stringify({players,guardians,coaches,remainingExampleNames:next.players.filter(p=>p.name.includes('Ejemplo')).length+next.coaches.filter(p=>p.name.includes('Ejemplo')).length+next.guardians.filter(p=>p.name.includes('Ejemplo')).length,applied:!!mutation&&process.argv.includes('--apply')}));
