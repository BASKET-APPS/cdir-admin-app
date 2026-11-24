/** Named writes only. All authority and invitation ownership are checked inside SQL Connect. */
export function memberOperations(gate){
 const checks="this.size() == 1 && vars.next == vars.version + 1 && vars.role in ['ADMIN','COACH'] && size(vars.name) >= 2 && size(vars.name) <= 200 && size(vars.email) <= 254 && vars.email == vars.email.lowerAscii() && vars.email.contains('@') && (vars.coach || vars.physical || vars.psychology)";
 return `
query BrowserInvitation @auth(level:USER_EMAIL_VERIFIED){
 members(where:{email:{eq_expr:"auth.token.email"},active:{eq:true}},limit:10) @check(expr:"this.exists(p,p.uid.startsWith('invite:'))",message:"CDIR_NO_INVITATION"){id uid name email role teamIds active}
 workspaceRevision(key:{id:"club"}){version}
}
mutation BrowserAuthorizeMember($memberId:UUID!,$uid:String!,$name:String!,$email:String!,$role:String!,$coachId:UUID!,$coachName:String!,$phone:String!,$qualification:String!,$coachFunctionId:UUID!,$physicalFunctionId:UUID!,$psychologyFunctionId:UUID!,$coach:Boolean!,$physical:Boolean!,$psychology:Boolean!,$version:Int!,$next:Int!) @auth(level:USER_EMAIL_VERIFIED) @transaction {
 query @redact {
 ${gate.replace('this.size() == 1',checks)}
 target:member(key:{id:$memberId}) @check(expr:"this == null || this.uid != auth.uid || (vars.uid == auth.uid && vars.role == 'ADMIN')",message:"CDIR_KEEP_OWN_ADMIN"){uid}
 emailOwners:members(where:{email:{eq:$email}},limit:10) @check(expr:"this.all(p,p.id == vars.memberId)",message:"CDIR_MEMBER_EXISTS"){id}
 uidOwners:members(where:{uid:{eq:$uid}},limit:10) @check(expr:"this.all(p,p.id == vars.memberId)",message:"CDIR_MEMBER_EXISTS"){id}
 targetCoach:coach(key:{id:$coachId}) @check(expr:"this == null || this.email == vars.email",message:"CDIR_COACH_MISMATCH"){email}
 emailCoaches:coaches(where:{email:{eq:$email}},limit:10) @check(expr:"this.all(p,p.id == vars.coachId)",message:"CDIR_COACH_EXISTS"){id}
 }
 lock:workspaceRevision_updateMany(where:{id:{eq:"club"},version:{eq:$version}},data:{version:$next}) @check(expr:"this == 1",message:"CDIR_CONCURRENT_CHANGE")
 member_upsert(data:{id:$memberId,uid:$uid,name:$name,email:$email,role:$role,teamIds:[],active:true})
 coach_upsert(data:{id:$coachId,name:$coachName,email:$email,phone:$phone,qualification:$qualification})
 coaching:staffFunctionRow_upsert(data:{id:$coachFunctionId,coachId:$coachId,kind:"COACH",active:$coach})
 physical:staffFunctionRow_upsert(data:{id:$physicalFunctionId,coachId:$coachId,kind:"PHYSICAL",active:$physical})
 psychology:staffFunctionRow_upsert(data:{id:$psychologyFunctionId,coachId:$coachId,kind:"PSYCHOLOGY",active:$psychology})
 audit_insert(data:{id_expr:"uuidV4()",at_expr:"request.time",actor_expr:"auth.token.email",actorUid_expr:"auth.uid",action:"member.authorized",detail:"Acceso y funciones autorizados por administración"})
}
mutation BrowserAcceptInvitation($memberId:UUID!,$version:Int!,$next:Int!) @auth(level:USER_EMAIL_VERIFIED) @transaction {
 query @redact {
 invitation:member(key:{id:$memberId}) @check(expr:"this != null && this.active && this.uid.startsWith('invite:') && this.email == auth.token.email && auth.token.firebase.sign_in_provider == 'google.com' && vars.next == vars.version + 1",message:"CDIR_INVITATION_REQUIRED"){id uid name email role active}
 existing:members(where:{uid:{eq_expr:"auth.uid"}},limit:1) @check(expr:"this.size() == 0",message:"CDIR_MEMBER_EXISTS"){id}
 }
 lock:workspaceRevision_updateMany(where:{id:{eq:"club"},version:{eq:$version}},data:{version:$next}) @check(expr:"this == 1",message:"CDIR_CONCURRENT_CHANGE")
 member_update(key:{id:$memberId},data:{uid_expr:"auth.uid"})
 audit_insert(data:{id_expr:"uuidV4()",at_expr:"request.time",actor_expr:"auth.token.email",actorUid_expr:"auth.uid",action:"member.invitationAccepted",detail:"Acceso por Google verificado"})
}
mutation BrowserSetMemberActive($memberId:UUID!,$active:Boolean!,$version:Int!,$next:Int!) @auth(level:USER_EMAIL_VERIFIED) @transaction {
 query @redact {
 ${gate.replace('this.size() == 1', 'this.size() == 1 && vars.next == vars.version + 1')}
 target:member(key:{id:$memberId}) @check(expr:"this != null && this.uid != auth.uid",message:"CDIR_KEEP_OWN_ADMIN"){uid}
 }
 lock:workspaceRevision_updateMany(where:{id:{eq:"club"},version:{eq:$version}},data:{version:$next}) @check(expr:"this == 1",message:"CDIR_CONCURRENT_CHANGE")
 member_update(key:{id:$memberId},data:{active:$active})
 audit_insert(data:{id_expr:"uuidV4()",at_expr:"request.time",actor_expr:"auth.token.email",actorUid_expr:"auth.uid",action:"member.accessChanged",detail:"Estado de acceso actualizado por administración"})
}
`;
}
