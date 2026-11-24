import fs from 'node:fs/promises';
import {memberOperations} from './browser-member-operations.mjs';
const contract=JSON.parse(await fs.readFile(new URL('../src/generated/sql-connect-contract.json',import.meta.url),'utf8'));
const gate=`access: members(where:{uid:{eq_expr:"auth.uid"},active:{eq:true},role:{eq:"ADMIN"}},limit:1) @check(expr:"this.size() == 1",message:"CDIR_ADMIN_REQUIRED") @redact {id}`;
const staffGate=`access: members(where:{uid:{eq_expr:"auth.uid"},active:{eq:true}},limit:1) @check(expr:"this.size() == 1",message:"CDIR_ACCESS_REQUIRED") @redact {id}`;
const fields=(k,omit=[])=>Object.keys(contract[k].fields).filter(f=>!omit.includes(f)).join(' ');
const seasonal=new Set(['teams','playerSeasons','guardianLinks','coachTeams','sessions','matches','playerRequests','crossTrainings','events','applications','invoices','supportSessions']);
const page=Object.entries(contract).filter(([k])=>!['files','profiles','bankAccounts'].includes(k)).map(([k,c])=>`${k}:${c.plural}(${seasonal.has(k)?'where:{seasonId:{eq:$seasonId}},':''}offset:$offset,limit:300,orderBy:{id:ASC}){${fields(k)}}`).join('\n');
let gql=`# Browser connector: checked in the database, never based on a client-selected role.
query BrowserIdentity @auth(level:USER_EMAIL_VERIFIED){
 ${staffGate}
 members(where:{uid:{eq_expr:"auth.uid"},active:{eq:true}},limit:1){${fields('members')}}
 seasons(limit:20){${fields('seasons')}}
 coaches(where:{email:{eq_expr:"auth.token.email"}},limit:10){${fields('coaches')}}
 coachTeams(where:{coach:{email:{eq_expr:"auth.token.email"}},function:{ne:"FORMER"}},limit:100){${fields('coachTeams')}}
 staffFunctions(where:{coach:{email:{eq_expr:"auth.token.email"}},active:{eq:true}},limit:20){${fields('staffFunctions')}}
 profiles(where:{uid:{eq_expr:"auth.uid"}},limit:1){id uid googlePhotoUrl avatarSource avatarVersion updatedAt googleSyncedAt}
}
query BrowserAdminPage($seasonId:UUID!,$offset:Int!) @auth(level:USER_EMAIL_VERIFIED){${gate}\nworkspaceRevision(key:{id:"club"}){version}\n${page}}
query BrowserPublicFeed($offset:Int!) @auth(level:PUBLIC){
 events(where:{status:{eq:"PUBLISHED"}},offset:$offset,limit:200){id title slug kind description location startsAt endsAt price registrationOpen imageUrl}
 matches(where:{published:{eq:true}},offset:$offset,limit:200){id seasonId teamId startsAt endsAt opponent venue location competition status scoreFor scoreAgainst isExample published}
 teams(offset:$offset,limit:200){id name}
 seasons(offset:$offset,limit:200){id name}
 magazines(where:{published:{eq:true}},offset:$offset,limit:200){id title description pdfPath publishedAt isExample published}
 clubActivities(where:{published:{eq:true}},offset:$offset,limit:200){id title description startsAt location imageUrl isExample published}
}
query BrowserPublicPdf($id:UUID!) @auth(level:PUBLIC){
 magazine(key:{id:$id}) @check(expr:"this != null && this.published",message:"CDIR_NOT_PUBLISHED") {published pdfPath}
 magazineDocuments(where:{magazineId:{eq:$id}},limit:1){payload size}
 magazineCovers(where:{magazineId:{eq:$id}},limit:1){payload etag}
}
query BrowserAdminPdf($id:UUID!) @auth(level:USER_EMAIL_VERIFIED){${gate}
 magazine(key:{id:$id}){published pdfPath}
 magazineDocuments(where:{magazineId:{eq:$id}},limit:1){payload size}
 magazineCovers(where:{magazineId:{eq:$id}},limit:1){payload etag}
}
`;
gql+=`query BrowserCoachPage($seasonId:UUID!,$teamId:UUID!,$offset:Int!) @auth(level:USER_EMAIL_VERIFIED){
 ${staffGate.replace('active:{eq:true}', 'active:{eq:true},role:{eq:"COACH"}')}
 sporting:staffFunctions(where:{coach:{email:{eq_expr:"auth.token.email"}},kind:{eq:"COACH"},active:{eq:true}},limit:1) @check(expr:"this.size() == 1",message:"CDIR_SPORTS_REQUIRED") @redact {id}
 assigned:coachTeams(where:{teamId:{eq:$teamId},seasonId:{eq:$seasonId},coach:{email:{eq_expr:"auth.token.email"}},function:{ne:"FORMER"}},limit:1) @check(expr:"this.size() == 1",message:"CDIR_TEAM_REQUIRED") @redact {id}
 teams(where:{id:{eq:$teamId}},limit:1){${fields('teams')}}
 seasons(limit:20){${fields('seasons')}} categories(limit:30){${fields('categories')}} venues(limit:100){${fields('venues')}}
 teamDetails:${contract.teamDetails.plural}(where:{teamId:{eq:$teamId}},limit:1){${fields('teamDetails')}}
 playerSeasons(where:{teamId:{eq:$teamId},seasonId:{eq:$seasonId}},offset:$offset,limit:300){${fields('playerSeasons')} player{id name birthDate active}}
 coachTeams(where:{teamId:{eq:$teamId},seasonId:{eq:$seasonId}},limit:10){${fields('coachTeams')} coach{${fields('coaches',['email','phone'])}}}
 sessions(where:{teamId:{eq:$teamId},seasonId:{eq:$seasonId}},offset:$offset,limit:300){${fields('sessions')}}
 matches(where:{teamId:{eq:$teamId},seasonId:{eq:$seasonId}},offset:$offset,limit:300){${fields('matches')}}
 attendance:${contract.attendance.plural}(where:{session:{teamId:{eq:$teamId},seasonId:{eq:$seasonId}}},offset:$offset,limit:300){${fields('attendance')}}
 playerRequests(where:{teamId:{eq:$teamId},seasonId:{eq:$seasonId}},offset:$offset,limit:300){${fields('playerRequests')}}
 requestPlayers(where:{request:{teamId:{eq:$teamId},seasonId:{eq:$seasonId}}},offset:$offset,limit:300){${fields('requestPlayers')}}
}
`;
for(const admin of [false,true])gql+=`query Browser${admin?'Admin':'Public'}Cover($id:UUID!) @auth(level:${admin?'USER_EMAIL_VERIFIED':'PUBLIC'}){
 ${admin?gate:'magazine(key:{id:$id}) @check(expr:"this != null && this.published",message:"CDIR_NOT_PUBLISHED") @redact {published}'}
 magazineCovers(where:{magazineId:{eq:$id}},limit:1){payload}
}\n`;
for(const admin of [false,true])gql+=`query Browser${admin?'Admin':'Public'}PdfParts($id:UUID!,$uploadId:UUID!,$offset:Int!) @auth(level:${admin?'USER_EMAIL_VERIFIED':'PUBLIC'}){
 ${admin?gate:'magazine(key:{id:$id}) @check(expr:"this != null && this.published",message:"CDIR_NOT_PUBLISHED") @redact {published}'}
 document:magazineDocuments(where:{magazineId:{eq:$id}},limit:1) @check(expr:${JSON.stringify("this.size() == 1 && this[0].payload.contains('\"uploadId\":\"' + string(vars.uploadId) + '\"')")},message:"CDIR_PDF_MISMATCH") @redact {payload}
 magazinePdfParts(where:{uploadId:{eq:$uploadId}},orderBy:{ordinal:ASC},offset:$offset,limit:2){ordinal payload}
}\n`;
gql+=memberOperations(gate);
await fs.mkdir(new URL('../dataconnect/browser/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../dataconnect/browser/connector.yaml',import.meta.url),'connectorId: "cdir-browser"\n');
await fs.writeFile(new URL('../dataconnect/browser/operations.gql',import.meta.url),gql);
console.log('Generated checked browser queries; existing admin connector unchanged.');
