'use client';
import {useRef,useState} from 'react';
import {Camera,Check,CheckCircle2,ImagePlus,ShieldCheck,Trash2,UserRound} from 'lucide-react';
import type {Identity,AvatarSource} from '@/domain/types';
import {authHeaders} from '@/lib/client-auth';
import UserAvatar from './user-avatar';

export default function ProfileSettings({user,mode,onChange}:{user:Identity;mode:string;onChange:(user:Identity)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const input=useRef<HTMLInputElement>(null);
 const uploadsEnabled=mode==='demo'||process.env.NEXT_PUBLIC_PROFILE_UPLOAD_ENABLED==='true';
 async function request(url:string,options:RequestInit){
  setBusy(true);setError('');setMessage('');
  try{const r=await fetch(url,{...options,headers:{...await authHeaders(),...options.headers}}),data=await r.json();if(!r.ok)throw new Error(data.message||'No se pudo guardar la imagen.');onChange(data.user);setMessage('Tu preferencia se ha guardado.');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function select(source:AvatarSource){void request('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'source',source})});}
 function upload(file:File){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Elige una foto JPG, PNG o WebP.');return;}
  if(file.size>3*1024*1024){setError('La foto debe ocupar menos de 3 MB.');return;}
  const data=new FormData();data.set('file',file);void request('/api/profile/avatar',{method:'POST',body:data});
 }
 return <div className='profile-settings'>
  <section className='panel profile-card'><div className='panel-head'><h2>Tu cuenta en CDIR</h2><ShieldCheck size={19}/></div><div className='profile-summary'><UserAvatar user={user} large/><div><h2>{user.name}</h2><p>{user.email}</p><span className='badge cyan'>{mode==='demo'?'Cuenta local de pruebas':'Cuenta vinculada a Google'}</span></div></div><div className='profile-account-note'><ShieldCheck size={16}/><p>Tu foto personal no cambia tu rol ni los equipos a los que tienes acceso.</p></div></section>
  <section className='panel profile-picture-card'><div className='panel-head'><h2>Foto de perfil</h2><Camera size={20}/></div><div className='profile-picture-content'><p>Elige la imagen que quieres mostrar en la administración.</p><div className='avatar-options' role='group' aria-label='Origen de la foto de perfil'>
   <button className={user.avatarSource==='GOOGLE'?'selected':''} aria-pressed={user.avatarSource==='GOOGLE'} disabled={busy||!user.googlePhotoUrl} onClick={()=>select('GOOGLE')}><span className='avatar-option-icon'><img src='/icons/google.svg' alt='' width='21' height='21'/></span><span><strong>Foto de Google</strong><small>{user.googlePhotoUrl?'Usar la imagen de tu cuenta':'Disponible tras acceder con Google'}</small></span>{user.avatarSource==='GOOGLE'?<Check size={17}/>:null}</button>
   <button className={user.avatarSource==='UPLOAD'?'selected':''} aria-pressed={user.avatarSource==='UPLOAD'} disabled={busy||!uploadsEnabled} onClick={()=>user.hasUploadedAvatar?select('UPLOAD'):input.current?.click()}><span className='avatar-option-icon'><ImagePlus size={22}/></span><span><strong>Foto personalizada</strong><small>{user.hasUploadedAvatar?'Volver a tu imagen subida':uploadsEnabled?'Subir una imagen desde tu dispositivo':'Disponible cuando se active el almacenamiento del club'}</small></span>{user.avatarSource==='UPLOAD'?<Check size={17}/>:null}</button>
   <button className={(!user.avatarSource||user.avatarSource==='INITIALS')?'selected':''} aria-pressed={!user.avatarSource||user.avatarSource==='INITIALS'} disabled={busy} onClick={()=>select('INITIALS')}><span className='avatar-option-icon'><UserRound size={22}/></span><span><strong>Mostrar mis iniciales</strong><small>Continuar sin foto de perfil</small></span>{(!user.avatarSource||user.avatarSource==='INITIALS')?<Check size={17}/>:null}</button>
  </div><input ref={input} className='sr-only' tabIndex={-1} type='file' accept='image/jpeg,image/png,image/webp' aria-label='Subir foto de perfil' disabled={busy} onChange={e=>{if(e.target.files?.[0])upload(e.target.files[0]);e.target.value='';}}/><div className='profile-photo-actions'><button className='button secondary' disabled={busy||!uploadsEnabled} onClick={()=>input.current?.click()}><Camera size={17}/>{busy?'Guardando…':user.hasUploadedAvatar?'Cambiar foto':'Subir foto'}</button>{user.hasUploadedAvatar?<button className='quiet-button' disabled={busy} onClick={()=>void request('/api/profile/avatar',{method:'DELETE'})}><Trash2 size={15}/>Eliminar foto subida</button>:null}</div><p className='profile-photo-help'>JPG, PNG o WebP · Máximo 3 MB. La imagen se ajusta a formato cuadrado y se eliminan sus metadatos.</p>{error?<p className='alert' role='alert'>{error}</p>:null}{message?<p className='profile-saved' role='status'><CheckCircle2 size={16}/>{message}</p>:null}</div></section>
 </div>;
}
