import {randomUUID} from 'node:crypto';
import {identity} from '@/server/auth';
import {failure} from '@/server/http';
import {sameOrigin} from '@/server/mode';
import {readOwnAvatarState,transaction} from '@/server/store';
import {avatarFile,readAvatar,removeAvatar,writeAvatar,inlineAvatar} from '@/server/avatar-storage';
import {identityWithProfile,ownProfile,requireOwnMember} from '@/domain/profile';
import {audit} from '@/domain/commands';

export const runtime='nodejs';
export async function GET(request:Request){
 try{const user=await identity(request),state=await readOwnAvatarState(user.uid),member=requireOwnMember(state,user),p=state.profiles.find(p=>p.uid===user.uid),url=new URL(request.url);
  if([...url.searchParams.keys()].some(k=>k!=='v'))throw new Error('Solo puedes consultar la foto de tu propia cuenta.');
  if(!p?.avatarPath||!(inlineAvatar(p.avatarPath)||p.avatarPath.startsWith('private/profiles/'+member.id+'/'))||url.searchParams.get('v')!==p.avatarVersion)return new Response(null,{status:404});
  const bytes=await readAvatar(p.avatarPath);
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 let saved:string|null=null,oldPath:string|null=null;
 try{sameOrigin(request);const user=await identity(request),bytes=await avatarFile(request);
  const result=await transaction(async s=>{
   const member=requireOwnMember(s,user),profile=ownProfile(s,user),version=randomUUID();
   const reference=process.env.CDIR_DATABASE==='sql-connect'?'data:image/webp;base64,'+bytes.toString('base64'):'private/profiles/'+member.id+'/'+version+'.webp';
   if(!inlineAvatar(reference)){await writeAvatar(reference,bytes);saved=reference;}oldPath=profile.avatarPath;
   profile.avatarPath=reference;profile.avatarVersion=version;profile.avatarSource='UPLOAD';profile.updatedAt=new Date().toISOString();
   audit(s,user,'profile.upload','Foto de perfil actualizada');return identityWithProfile(s,user);
  });
  if(oldPath)await removeAvatar(oldPath).catch(()=>{});
  return Response.json({user:result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(saved)await removeAvatar(saved).catch(()=>{});return failure(e);}
}
export async function DELETE(request:Request){
 try{sameOrigin(request);const user=await identity(request);let oldPath:string|null=null;
  const result=await transaction(s=>{const profile=ownProfile(s,user);oldPath=profile.avatarPath;profile.avatarPath=null;profile.avatarVersion=null;if(profile.avatarSource==='UPLOAD')profile.avatarSource=profile.googlePhotoUrl?'GOOGLE':'INITIALS';profile.updatedAt=new Date().toISOString();audit(s,user,'profile.remove','Foto subida retirada del perfil');return identityWithProfile(s,user);});
  if(oldPath)await removeAvatar(oldPath).catch(()=>{});
  return Response.json({user:result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
