import {identity} from '@/server/auth';
import {readCoachAvatarState} from '@/server/store';
import {requirePermission} from '@/domain/permissions';
import {coachProfile} from '@/domain/coach-photo';
import {readAvatar,inlineAvatar} from '@/server/avatar-storage';
import {failure} from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const user=await identity(request);requirePermission(user,'sports');const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return new Response(null,{status:404});const s=await readCoachAvatarState(id);
  if(user.role==='COACH'&&!s.coachTeams.some(c=>c.coachId===id&&user.teamIds.includes(c.teamId)))throw Error('No tienes acceso a este entrenador.');
  const linked=coachProfile(s,id),v=new URL(request.url).searchParams.get('v');
  if(!linked||linked.profile.avatarSource!=='UPLOAD'||!linked.profile.avatarPath||!(inlineAvatar(linked.profile.avatarPath)||linked.profile.avatarPath.startsWith('private/profiles/'+linked.member.id+'/'))||v!==linked.profile.avatarVersion)return new Response(null,{status:404});
  const bytes=await readAvatar(linked.profile.avatarPath);return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(e){return failure(e);}
}
