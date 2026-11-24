import {randomUUID} from 'node:crypto';
import type {AvatarSource,Identity,State,UserProfile} from './types';

export function googlePhotoUrl(raw:unknown):string|null{
 if(typeof raw!=='string'||raw.length>2048)return null;
 try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&(url.hostname==='googleusercontent.com'||url.hostname.endsWith('.googleusercontent.com'))?url.href:null;}catch{return null;}
}

export function requireOwnMember(s:State,user:Identity){
 const member=s.members.find(m=>m.uid===user.uid&&m.active);
 if(!member)throw new Error('Tu cuenta no tiene acceso al club.');
 return member;
}

export function ownProfile(s:State,user:Identity):UserProfile{
 requireOwnMember(s,user);
 let profile=s.profiles.find(p=>p.uid===user.uid);
 if(!profile){profile={id:randomUUID(),uid:user.uid,googlePhotoUrl:null,avatarPath:null,avatarVersion:null,avatarSource:'INITIALS',googleSyncedAt:null,updatedAt:new Date().toISOString()};s.profiles.push(profile);}
 return profile;
}

export function syncGoogleProfile(s:State,user:Identity,providerPhoto:unknown){
 const first=!s.profiles.some(p=>p.uid===user.uid),profile=ownProfile(s,user),url=googlePhotoUrl(providerPhoto);
 profile.googlePhotoUrl=url;
 if(first&&url&&profile.avatarSource==='INITIALS')profile.avatarSource='GOOGLE';
 if(profile.avatarSource==='GOOGLE'&&!url)profile.avatarSource='INITIALS';
 profile.googleSyncedAt=new Date().toISOString();profile.updatedAt=profile.googleSyncedAt;
 return profile;
}

export function chooseAvatar(s:State,user:Identity,source:AvatarSource){
 const profile=ownProfile(s,user);
 if(source==='GOOGLE'&&!profile.googlePhotoUrl)throw new Error('Tu cuenta no tiene una foto de Google disponible.');
 if(source==='UPLOAD'&&(!profile.avatarPath||!profile.avatarVersion))throw new Error('Sube primero una imagen de perfil.');
 profile.avatarSource=source;profile.updatedAt=new Date().toISOString();
 return profile;
}

export function identityWithProfile(s:State,user:Identity):Identity{
 const p=s.profiles.find(x=>x.uid===user.uid),source=p?.avatarSource||'INITIALS';
 return {...user,avatarSource:source,avatarUrl:source==='GOOGLE'?googlePhotoUrl(p?.googlePhotoUrl):source==='UPLOAD'&&p?.avatarVersion?'/api/profile/avatar?v='+p.avatarVersion:null,googlePhotoUrl:googlePhotoUrl(p?.googlePhotoUrl),hasUploadedAvatar:!!p?.avatarPath};
}
