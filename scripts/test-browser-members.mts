/** Real permission tests. Application writes roll back; one synthetic invitation fixture is cleaned in finally. */
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {sqlConnect,sqlConnectRevision} from '../src/server/sql-connect-store';import {normalizeWorkspacePage} from '../src/domain/sql-connect';import {memberVariables} from '../src/domain/browser-member';import type {Member} from '../src/domain/types';
const dc=sqlConnect(),source=await fs.readFile('dataconnect/browser/operations.gql','utf8');
const ops=Object.fromEntries(source.split(/(?=\b(?:query|mutation) Browser)/).filter(q=>/^(query|mutation) /.test(q)).map(q=>[q.match(/^(?:query|mutation) (\w+)/)![1],q]));
const raw=(await dc.executeGraphqlRead<Record<string,unknown>,undefined>('query MemberTestData @auth(level:NO_ACCESS){members(limit:100){id uid name email role teamIds active} coaches(limit:100){id name email phone qualification} staffFunctions(limit:300){id coachId kind active}}')).data;
const state=normalizeWorkspacePage(raw),admin=state.members.find(m=>m.active&&m.role==='ADMIN')!,coach=state.members.find(m=>m.active&&m.role==='COACH')!;
assert(admin&&coach);const version=await sqlConnectRevision();
const claims=(m:Pick<Member,'uid'|'email'>,verified=true,provider='google.com')=>({sub:m.uid,email:m.email,email_verified:verified,firebase:{sign_in_provider:provider,identities:{}}});
const email='transaction-'+randomUUID()+'@example.invalid';
const variables=await memberVariables(state,admin,{name:'Prueba transaccional',email,role:'ADMIN',staffFunctions:['COACH','PHYSICAL']},version);
const rollback=' probeRollback:workspaceRevision_updateMany(where:{id:{eq:"cdir-probe-never-created"}},data:{version:0}) @check(expr:"false",message:"CDIR_PROBE_ROLLBACK")\n';
const abortAfterWrites=(q:string)=>q.trim().replace(/}\s*$/,rollback+'}');
async function expectFailure(label:string,query:string,vars:Record<string,unknown>,impersonate:Parameters<typeof dc.executeGraphql>[1] extends {impersonate?:infer T}?T:never,expected:string){let message='';try{await dc.executeGraphql(query,{variables:vars,impersonate} as Parameters<typeof dc.executeGraphql>[1]);}catch(e){message=String(e);}assert(message.includes(expected),label+' did not fail at '+expected+'; diagnostic: '+message.slice(0,500));console.log('PASS: '+label);}
await expectFailure('administrator writes member, coach and combined functions before transaction rollback',abortAfterWrites(ops.BrowserAuthorizeMember),variables,{authClaims:claims(admin)} as never,'CDIR_PROBE_ROLLBACK');
const existing=await memberVariables(state,admin,{name:coach.name,email:coach.email,role:coach.role,staffFunctions:['COACH']},version);
await expectFailure('existing account and professional update without duplicate rows before rollback',abortAfterWrites(ops.BrowserAuthorizeMember),existing,{authClaims:claims(admin)} as never,'CDIR_PROBE_ROLLBACK');
for(const [label,impersonate] of [['anonymous',{unauthenticated:true}],['coach',{authClaims:claims(coach)}],['unknown account',{authClaims:claims({uid:'unregistered-permission-probe',email:'unregistered@example.invalid'})}]] as const)await expectFailure(label+' cannot authorize an administrator',abortAfterWrites(ops.BrowserAuthorizeMember),variables,impersonate as never,label==='anonymous'?'auth':'CDIR_ADMIN_REQUIRED');
await expectFailure('administrator cannot demote themselves',abortAfterWrites(ops.BrowserAuthorizeMember),{...variables,memberId:admin.id,uid:admin.uid,email:admin.email,role:'COACH'},{authClaims:claims(admin)} as never,'CDIR_KEEP_OWN_ADMIN');
await expectFailure('stale revision cannot save permissions',abortAfterWrites(ops.BrowserAuthorizeMember),{...variables,version:version-1,next:version},{authClaims:claims(admin)} as never,'CDIR_CONCURRENT_CHANGE');
await expectFailure('administrator can withdraw access before rollback',abortAfterWrites(ops.BrowserSetMemberActive),{memberId:coach.id,active:false,version,next:version+1},{authClaims:claims(admin)} as never,'CDIR_PROBE_ROLLBACK');
await expectFailure('administrator cannot disable themselves',abortAfterWrites(ops.BrowserSetMemberActive),{memberId:admin.id,active:false,version,next:version+1},{authClaims:claims(admin)} as never,'CDIR_KEEP_OWN_ADMIN');
await expectFailure('coach cannot withdraw another account access',abortAfterWrites(ops.BrowserSetMemberActive),{memberId:admin.id,active:false,version,next:version+1},{authClaims:claims(coach)} as never,'CDIR_ADMIN_REQUIRED');
const acceptedId=randomUUID(),acceptedUid='verified-probe-'+randomUUID(),inviteEmail='claim-'+randomUUID()+'@example.invalid';
const claimProbe=abortAfterWrites(ops.BrowserAcceptInvitation);
const claimVars={memberId:acceptedId,version,next:version+1};
// Embedded queries use the initial snapshot, so the invitation fixture must pre-exist the tested transaction.
await dc.executeGraphql('mutation Fixture($data:Member_Data!) @auth(level:NO_ACCESS){member_insert(data:$data)}',{variables:{data:{id:acceptedId,uid:'invite:'+acceptedId,name:'Prueba transaccional',email:inviteEmail,role:'COACH',teamIds:[],active:true}}});
try{
await expectFailure('verified invited Google account can bind its uid before rollback',claimProbe,claimVars,{authClaims:claims({uid:acceptedUid,email:inviteEmail})} as never,'CDIR_PROBE_ROLLBACK');
await expectFailure('another Google email cannot claim invitation',claimProbe,claimVars,{authClaims:claims({uid:acceptedUid,email:'other@example.invalid'})} as never,'CDIR_INVITATION_REQUIRED');
await expectFailure('password provider cannot claim Google invitation',claimProbe,claimVars,{authClaims:claims({uid:acceptedUid,email:inviteEmail},true,'password')} as never,'CDIR_INVITATION_REQUIRED');
}finally{await dc.executeGraphql('mutation CleanFixture($id:UUID!) @auth(level:NO_ACCESS){member_delete(key:{id:$id})}',{variables:{id:acceptedId}});}
const after=(await dc.executeGraphqlRead<{member:null;coach:null;accepted:null},{memberId:string;coachId:string;acceptedId:string}>('query AfterProbe($memberId:UUID!,$coachId:UUID!,$acceptedId:UUID!) @auth(level:NO_ACCESS){member(key:{id:$memberId}){id} coach(key:{id:$coachId}){id} accepted:member(key:{id:$acceptedId}){id}}',{variables:{memberId:variables.memberId,coachId:variables.coachId,acceptedId}})).data;
assert.equal(after.member,null);assert.equal(after.coach,null);assert.equal(after.accepted,null);assert.equal(await sqlConnectRevision(),version);console.log('PASS: database revision unchanged; no test members, coaches or invitations persisted.');
