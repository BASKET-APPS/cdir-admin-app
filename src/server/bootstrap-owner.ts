import 'server-only';
import {randomUUID} from 'node:crypto';
import {serverAuth} from './firebase';
import {transaction} from './store';
import {audit} from '@/domain/commands';
import {identityWithProfile,syncGoogleProfile} from '@/domain/profile';
import type {Member} from '@/domain/types';

// One-time installation: only the server-configured owner may initialize an empty club.
// Once any member exists, all account authorizations go through the existing admin.
export async function bootstrapOwner(uid:string,email:string){
 const owner=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
 if(process.env.CDIR_DATABASE!=='sql-connect'||!owner||email.toLowerCase()!==owner)return null;
 const account=await serverAuth().getUser(uid);
 if(!account.emailVerified||account.disabled||account.email?.toLowerCase()!==owner||!account.providerData.some(p=>p.providerId==='google.com'))return null;
 return transaction(s=>{
  const own=s.members.find(m=>m.uid===uid&&m.active);if(own)return identityWithProfile(s,own);
  if(s.members.length)return null;
  const member:Member={id:randomUUID(),uid,name:account.displayName||'Administración CDIR',email:account.email!,role:'ADMIN',teamIds:[],active:true};
  s.members.push(member);syncGoogleProfile(s,member,account.providerData.find(p=>p.providerId==='google.com')?.photoURL);
  audit(s,member,'installation.owner','Primer administrador autorizado durante la instalación');
  return identityWithProfile(s,member);
 });
}
