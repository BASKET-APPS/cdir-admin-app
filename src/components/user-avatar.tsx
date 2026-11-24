'use client';
import {useEffect,useState} from 'react';
import type {Identity} from '@/domain/types';
import {authHeaders} from '@/lib/client-auth';

// Avatar images of the signed-in session, shared by every <UserAvatar> (menu, profile, coach cards).
// URLs carry the avatar version, so an entry never goes stale; it is dropped on sign-out or user change.
const avatars=new Map<string,Promise<Blob>>();
export function clearAvatarCache(){avatars.clear();}
function avatarBlob(source:string){let work=avatars.get(source);if(!work){work=(async()=>{const r=await fetch(source,{headers:await authHeaders(),cache:'no-store'});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw new Error('Imagen no disponible');return r.blob();})();avatars.set(source,work);work.catch(()=>avatars.delete(source));}return work;}
export default function UserAvatar({user,large=false}:{user:Identity;large?:boolean}){
 const [localUrl,setLocalUrl]=useState<string|null>(null),[failed,setFailed]=useState(false);
 const source=user.avatarUrl||null;
 useEffect(()=>{
  setFailed(false);setLocalUrl(null);
  if(!source?.startsWith('/api/'))return;
  let objectUrl:string|null=null,active=true;
  (async()=>{try{const blob=await avatarBlob(source);if(!active)return;objectUrl=URL.createObjectURL(blob);setLocalUrl(objectUrl);}catch{if(active)setFailed(true);}})();
  return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[source]);
 const src=source?.startsWith('/api/')?localUrl:source;
 return <span className={'avatar user-avatar '+(large?'large':'')} aria-hidden='true'><span>{user.name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span>{src&&!failed?<img src={src} alt='' referrerPolicy='no-referrer' onError={()=>setFailed(true)}/>:null}</span>;
}
