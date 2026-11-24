import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDataConnect} from 'firebase-admin/data-connect';
import {randomUUID} from 'node:crypto';
if(process.env.FIREBASE_PROJECT_ID!=='cdir-apps')throw Error('Proyecto incorrecto.');
if(!process.env.ADMIN_EMAIL)throw Error('Indica ADMIN_EMAIL para autorizar al propietario.');
const app=initializeApp({credential:applicationDefault(),projectId:'cdir-apps'}),auth=getAuth(app);
const dc=getDataConnect({serviceId:'cdir-apps-2-service',location:'europe-southwest1'},app);
const query='query BootstrapCheck @auth(level: NO_ACCESS) { workspaceRevision(key: {id: "club"}) { version } members { id uid email role } }';
const existing=(await dc.executeGraphqlRead(query)).data;
if(!existing.workspaceRevision){await dc.executeGraphql('mutation InitializeRevision @auth(level: NO_ACCESS) { workspaceRevision_insert(data: {id: "club", version: 0}) }');existing.workspaceRevision={version:0};}
let user;
try{user=await auth.getUserByEmail(process.env.ADMIN_EMAIL);}catch(e){if(e.code==='auth/user-not-found'){console.log('SQL Connect accesible. Falta entrar una vez con Google en la app para crear el usuario de Authentication.');process.exit(2);}throw e;}
if(!user.emailVerified)throw Error('El propietario debe tener un correo verificado por Google.');
const current=existing.members.find(m=>m.uid===user.uid);
if(!current&&existing.members.length)throw Error('Ya hay miembros. Autoriza esta cuenta desde la administración existente.');
const variables={member:{id:current?.id||randomUUID(),uid:user.uid,name:user.displayName||'Administración CDIR',email:user.email,role:'ADMIN',teamIds:[],active:true}};
const fields=['member: member_upsert(data: $member)'];
if(!existing.workspaceRevision)fields.unshift('workspaceRevision_insert(data: {id: "club",version: 0})');
await dc.executeGraphql(`mutation Bootstrap($member: Member_Data!) @auth(level: NO_ACCESS) @transaction { ${fields.join(' ')} }`,{variables});
console.log('Base SQL Connect inicializada y cuenta propietaria autorizada. No se han importado datos ficticios.');
