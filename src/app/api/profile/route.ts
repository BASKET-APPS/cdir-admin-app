import {z} from 'zod';
import {identity} from '@/server/auth';
import {boundedJson,failure} from '@/server/http';
import {sameOrigin,demoMode} from '@/server/mode';
import {serverAuth} from '@/server/firebase';
import {readState,readIdentityState,transaction} from '@/server/store';
import {audit} from '@/domain/commands';
import {chooseAvatar,identityWithProfile,syncGoogleProfile} from '@/domain/profile';
import {ensureCoach} from '@/domain/people';

export const runtime='nodejs';
export async function GET(request:Request){try{const user=await identity(request);return Response.json({user},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(request:Request){
 try{
  sameOrigin(request);const user=await identity(request),body=await boundedJson(request);
  const command=z.discriminatedUnion('action',[
   z.object({action:z.literal('source'),source:z.enum(['GOOGLE','UPLOAD','INITIALS'])}).strict(),
   z.object({action:z.literal('syncGoogle')}).strict(),
  ]).parse(body);
  let googlePhoto:unknown;
  if(command.action==='syncGoogle'){
   if(demoMode())return Response.json({user},{headers:{'Cache-Control':'no-store'}});
   const state=await readIdentityState(user.uid,user.email),old=state.profiles.find(p=>p.uid===user.uid);
   // Recent sync: only open a (full) transaction when the coach profile is really missing.
   const hasCoach=!!user.staffCoachIds?.length||state.coaches.some(c=>c.email.toLowerCase()===user.email.toLowerCase());
   if(old?.googleSyncedAt&&Date.now()-new Date(old.googleSyncedAt).getTime()<86_400_000){if(!hasCoach)await transaction(s=>{if(!s.coaches.some(c=>c.email.toLowerCase()===user.email.toLowerCase())){ensureCoach(s,user);audit(s,user,'coach.profile','Cuenta vinculada al perfil de entrenador');}});return Response.json({user:identityWithProfile(state,user)},{headers:{'Cache-Control':'no-store'}});}
   const account=await serverAuth().getUser(user.uid);
   googlePhoto=account.providerData.find(p=>p.providerId==='google.com')?.photoURL;
  }
  const result=await transaction(s=>{
   if(!s.coaches.some(c=>c.email.toLowerCase()===user.email.toLowerCase())){ensureCoach(s,user);audit(s,user,'coach.profile','Cuenta vinculada al perfil de entrenador');}
   if(command.action==='source'){chooseAvatar(s,user,command.source);audit(s,user,'profile.source','Preferencia de imagen de perfil actualizada');}
   else syncGoogleProfile(s,user,googlePhoto);
   return identityWithProfile(s,user);
  });
  return Response.json({user:result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
