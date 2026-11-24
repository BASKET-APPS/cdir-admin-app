import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getDataConnect} from 'firebase-admin/data-connect';
import {randomUUID} from 'node:crypto';
import {emptyState,type State} from '../src/domain/types';
import {workspacePageQuery,normalizeWorkspacePage,revisionQuery,workspaceMutation} from '../src/domain/sql-connect';
import {ensureCoach} from '../src/domain/people';
if(process.env.FIREBASE_PROJECT_ID!=='cdir-apps')throw Error('Proyecto inesperado.');
const dc=getDataConnect({serviceId:'cdir-apps-2-service',location:'europe-southwest1'},initializeApp({credential:applicationDefault(),projectId:'cdir-apps'}));
const revision=(await dc.executeGraphqlRead<{workspaceRevision:{version:number}},undefined>(revisionQuery)).data.workspaceRevision.version,before=emptyState();
for(let offset=0;;offset+=500){const p=normalizeWorkspacePage((await dc.executeGraphqlRead<Record<string,unknown>,undefined>(workspacePageQuery(offset))).data);for(const k of Object.keys(p) as (keyof State)[])(before[k] as unknown[]).push(...p[k]);if(!Object.values(p).some(r=>r.length===500))break;}
const next=structuredClone(before),owner=next.members.find(m=>m.active&&m.role==='ADMIN'&&m.email.toLowerCase()===process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase());
let linkedPlayer=false;
if(owner){const candidates=next.players.filter(p=>/^juan carlos(?:\s|$)/i.test(p.name.trim())&&!next.playerDetails.find(d=>d.playerId===p.id)?.isExample);if(candidates.length>1)throw Error('Hay varios Juan Carlos; hace falta elegir la ficha.');if(candidates.length===1){const p=candidates[0];if(p.email&&p.email.toLowerCase()!==owner.email.toLowerCase())throw Error('La ficha tiene otro correo; revisa la vinculación.');p.email=owner.email;const coach=ensureCoach(next,{...owner,name:p.name})!;coach.name=p.name;const d=next.coachDetails.find(d=>d.coachId===coach.id);if(d&&!d.photoUrl)d.photoUrl=next.playerDetails.find(d=>d.playerId===p.id)?.photoUrl||'';for(const l of next.guardianLinks.filter(l=>l.playerId===p.id&&l.relationship==='Propio responsable')){const g=next.guardians.find(g=>g.id===l.guardianId);if(g&&!g.email)g.email=owner.email;}linkedPlayer=true;}}
for(const m of next.members.filter(m=>m.active))ensureCoach(next,m);
let mutation=workspaceMutation(before,next,revision);
if(mutation){next.audit.push({id:randomUUID(),at:new Date().toISOString(),actor:'Administración CDIR',actorUid:owner?.uid||'club-profile-link',action:'coach.account.link',detail:'Perfiles deportivos vinculados a cuentas autorizadas; los roles y equipos de acceso se conservan.'});mutation=workspaceMutation(before,next,revision);if(process.argv.includes('--apply'))await dc.executeGraphql(mutation!.query,{variables:mutation!.variables});}
console.log(JSON.stringify({linkedPlayer,addedCoaches:next.coaches.length-before.coaches.length,rolesChanged:false,applied:!!mutation&&process.argv.includes('--apply')}));
