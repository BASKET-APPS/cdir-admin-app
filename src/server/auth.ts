import {coachIdentity} from '@/domain/people';
import 'server-only';
import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import type {Identity} from '@/domain/types';
import {demoMode,localRequest} from './mode';
import {serverAuth} from './firebase';
import {readState,readIdentityState,transaction} from './store';
import {identityWithProfile} from '@/domain/profile';
import {bootstrapOwner} from './bootstrap-owner';
const g=globalThis as unknown as {cdirDemoKey?:string};
function demoKey(){return g.cdirDemoKey??=randomBytes(32).toString('hex');}
export function demoCookie(){const value=String(Date.now());return value+'.'+createHmac('sha256',demoKey()).update(value).digest('hex');}
function validDemo(value:string){const [time,sig]=value.split('.');if(!time||!sig||Date.now()-Number(time)>8*3600000||Number(time)>Date.now())return false;const expected=createHmac('sha256',demoKey()).update(time).digest('hex');return sig.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}
export async function identity(request:Request):Promise<Identity>{
 if(demoMode()){if(!localRequest(request))throw new Error('El modo de prueba solo está disponible en localhost.');const cookie=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('cdir_demo='))?.slice(10)||'';if(!validDemo(cookie))throw new Error('Inicia sesión para continuar.');const s=await readState();const member=s.members.find(m=>m.uid==='demo-local-admin'&&m.active);if(!member)throw new Error('No está preparada la cuenta local de prueba.');return identityWithProfile(s,coachIdentity(s,member));}
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)throw new Error('Inicia sesión para continuar.');const decoded=await serverAuth().verifyIdToken(token,true);if(!decoded.email_verified)throw new Error('Verifica tu dirección de correo.');const s=await readIdentityState(decoded.uid,decoded.email||'');const member=s.members.find(x=>x.uid===decoded.uid&&x.active);if(!member){const invitation=s.members.find(m=>m.active&&m.uid.startsWith('invite:')&&m.email.toLowerCase()===decoded.email?.toLowerCase());if(invitation&&decoded.firebase?.sign_in_provider==='google.com'){return transaction(state=>{const pending=state.members.find(m=>m.id===invitation.id&&m.active&&m.uid.startsWith('invite:'));if(!pending)throw Error('Vuelve a iniciar sesión.');pending.uid=decoded.uid;state.audit.push({id:randomUUID(),at:new Date().toISOString(),actor:pending.name,actorUid:pending.uid,action:'member.invitationAccepted',detail:'Acceso por Google verificado'});return identityWithProfile(state,coachIdentity(state,pending));});}if(!s.members.length&&decoded.email){const owner=await bootstrapOwner(decoded.uid,decoded.email);if(owner)return owner;}throw new Error('Tu cuenta no tiene acceso al club.');}return identityWithProfile(s,coachIdentity(s,member));
}
