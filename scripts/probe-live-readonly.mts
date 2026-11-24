/** Explicit diagnostic: real cdir-apps reads, no writes, no personal data in output. */
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {sqlConnect,sqlConnectRevision} from '../src/server/sql-connect-store';
import {readWorkspace} from '../src/server/scoped-store';
import {visibleState} from '../src/domain/permissions';
import {GET as publicGet} from '../src/app/api/public/club/route';
import {GET as workspaceGet} from '../src/app/api/workspace/route';
import type {Member} from '../src/domain/types';

if(process.env.FIREBASE_PROJECT_ID!=='cdir-apps')throw Error('Only the cdir-apps project is allowed.');
process.env.CDIR_DATABASE='sql-connect';process.env.CDIR_MODE='firebase';
process.env.PUBLIC_REGISTRATION_ENABLED='false';
const report:{at:string;project:string;checks:Record<string,unknown>[]}={at:new Date().toISOString(),project:'cdir-apps',checks:[]};
let operations=0,bytes=0;
const dc=sqlConnect(),read=dc.executeGraphqlRead.bind(dc);
dc.executeGraphqlRead=(async (...args:Parameters<typeof dc.executeGraphqlRead>)=>{operations++;const r=await read(...args);bytes+=Buffer.byteLength(JSON.stringify(r.data));return r;}) as typeof dc.executeGraphqlRead;
// Even an accidental mutation from an imported diagnostic is blocked.
dc.executeGraphql=async()=>{throw Error('WRITES_BLOCKED_BY_READONLY_PROBE');};
function classification(e:unknown){const x=e as {code?:string;message?:string};const m=String(x.message||'');return {code:x.code||'unknown',category:/egress|quota|RESOURCE_EXHAUSTED/i.test(m)?'QUOTA':/credential|invalid_grant|reauth|token|UNAUTHENTICATED/i.test(m)?'AUTHENTICATION':/permission|PERMISSION_DENIED|403/i.test(m)?'PERMISSION':/schema|validation|cannot mix|unknown field/i.test(m)?'QUERY_SCHEMA':'CONNECTION_OR_SERVICE'};}
async function check(name:string,run:()=>Promise<Record<string,unknown>>){const start=performance.now(),before=operations;try{const result=await run();const row={name,ok:true,ms:Math.round(performance.now()-start),sqlReads:operations-before,...result};report.checks.push(row);console.log(JSON.stringify(row));return true;}catch(e){const row={name,ok:false,ms:Math.round(performance.now()-start),sqlReads:operations-before,...classification(e)};report.checks.push(row);console.log(JSON.stringify(row));return false;}}
let admin:Member|undefined,coach:Member|undefined;
const connected=await check('real_database_connection',async()=>{const r=await dc.executeGraphqlRead<{workspaceRevision:{version:number}|null;seasons:{current:boolean}[];admins:Member[];coaches:Member[]},undefined>(`query ConnectivityReadOnly @auth(level:NO_ACCESS) {
 workspaceRevision(key:{id:"club"}) {version}
 seasons(limit:10) {current}
 admins:members(where:{active:{eq:true},role:{eq:"ADMIN"}},limit:1) {id uid name email role teamIds active}
 coaches:members(where:{active:{eq:true},role:{eq:"COACH"}},limit:1) {id uid name email role teamIds active}
}`);admin=r.data.admins[0];coach=r.data.coaches[0];return {revisionExists:!!r.data.workspaceRevision,seasons:r.data.seasons.length,activeAdminExists:!!admin,activeCoachExists:!!coach};});
if(connected){
 await check('public_website_real_api',async()=>{const r=await publicGet(new Request('https://readonly-probe.invalid/api/public/club?sections=events,matches,magazines,activities&matchView=recent'));if(!r.ok){const d=await r.json();throw Error(String(d.message||'Public API failed'));}const data=await r.json();if(Object.keys(data).some(k=>!['events','matches','magazines','activities'].includes(k)))throw Error('Unexpected public field');return {httpStatus:r.status,records:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,Array.isArray(v)?v.length:0])),privateCollectionsExposed:false};});
 if(admin)await check('administration_real_workspace_read',async()=>{const result=await readWorkspace(admin!);const state=visibleState(result.state,admin!);return {seasonFound:!!result.seasonId,teams:state.teams.filter(t=>t.seasonId===result.seasonId).length,players:state.players.length,coaches:state.coaches.length,sessions:state.sessions.length,matches:state.matches.length,magazines:state.magazines.length,source:'production readWorkspace; service credentials; no browser login simulated'};});
 if(coach)await check('coach_real_workspace_read',async()=>{const identityState=(await import('../src/server/sql-connect-store')).readSqlConnectIdentity;const {coachIdentity}=await import('../src/domain/people');const identity=coachIdentity(await identityState(coach!.uid,coach!.email),coach!);const result=await readWorkspace(identity);const state=visibleState(result.state,identity);return {teams:state.teams.filter(t=>t.seasonId===result.seasonId).length,players:state.players.length,matches:state.matches.length,guardiansVisible:state.guardians.length,bankAccountsVisible:state.bankAccounts.length};});
}
await check('unauthenticated_administration_is_blocked',async()=>{const r=await workspaceGet(new Request('https://readonly-probe.invalid/api/workspace'));if(r.status!==401)throw Error('Expected 401');return {httpStatus:r.status};});
for(const [name,url] of [['published_public','https://basket-apps.github.io/front-cdir/'],['published_administration','https://basket-apps.github.io/cdir-admin-app/perfil/'],['planned_backend','https://cdir-apps.web.app/api/public/club?sections=magazines']])await check(name,async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});const body=await r.text();return {httpStatus:r.status,demoBanner:body.includes('DATOS FICTICIOS'),firebaseApi:r.headers.get('content-type')?.includes('application/json')||false};});
const totals={readOperations:operations,approximateSdkResponseBytes:bytes,writesBlocked:true};console.log(JSON.stringify(totals));
await fs.mkdir('../_local-servers',{recursive:true});await fs.writeFile('../_local-servers/firebase-readonly-report.json',JSON.stringify({...report,totals},null,2));
if(report.checks.some(c=>c.ok===false))process.exitCode=1;
