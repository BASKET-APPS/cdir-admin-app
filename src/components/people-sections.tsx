'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import ProfessionalCreate from './professional-create';
import {staffLabels} from '@/domain/support-labels';
import type {StaffFunction} from '@/domain/types';
import {ArrowUpRight,Users,Phone,Mail,CreditCard,Plus,X,GraduationCap,ShieldCheck,UserRound} from 'lucide-react';
import type {PublicState,Identity,Player,Guardian} from '@/domain/types';
import {familyGroups} from '@/domain/people';
import UserAvatar from './user-avatar';

type Props={section:string;s:PublicState;user:Identity;seasonId:string;query:string;onPlayer:(p:Player)=>void;onAction:(action:string,payload:unknown)=>Promise<boolean>};
export default function PeopleSections({section,s,user,seasonId,query,onPlayer,onAction}:Props){
 const [selected,setSelected]=useState(''),[edit,setEdit]=useState<Partial<Guardian>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[bank,setBank]=useState(false),[page,setPage]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement|null>(null),families=familyGroups(s,seasonId),family=families.find(f=>f.id===selected),coach=s.coaches.find(c=>c.id===selected),isFamily=section==='familias';
 const teamName=(id:string|null)=>s.teams.find(t=>t.id===id)?.name||'Sin equipo';
 const assignments=(id:string)=>s.coachTeams.filter(c=>c.coachId===id&&c.seasonId===seasonId&&c.function!=='FORMER');
 const editable=user.role==='ADMIN'||user.role==='SECRETARY';
 const financial=user.role==='ADMIN'||user.role==='TREASURY';
 useEffect(()=>{setSelected(!isFamily?new URLSearchParams(window.location.search).get('coach')||'':'');setEdit(null);setBank(false);setError('');},[section,seasonId]);
 useEffect(()=>{if(selected||edit){if(!dialog.current?.open){trigger.current=document.activeElement as HTMLElement;dialog.current?.showModal();}}else{dialog.current?.close();trigger.current?.focus();}},[selected,edit]);
 function close(){setSelected('');setEdit(null);setBank(false);setError('');}
 const found=(...values:string[])=>values.join(' ').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'));
 function photo(id:string){const c=s.coaches.find(c=>c.id===id)!;return c.email&&c.email.toLowerCase()===user.email.toLowerCase()?user.avatarUrl:s.coachDetails.find(d=>d.coachId===id)?.photoUrl;}
 function CoachPhoto({id,large=false}:{id:string;large?:boolean}){const c=s.coaches.find(c=>c.id===id)!;return <UserAvatar user={{...user,name:c.name,avatarUrl:photo(id)}} large={large}/>;}
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);
  try{const action=bank?'bank':'guardian',payload=bank?{playerSeasonId:String(f.get('playerSeasonId')),holder:String(f.get('holder')),holderDocument:String(f.get('holderDocument')),iban:String(f.get('iban')),mandateReference:String(f.get('mandateReference')),mandateDate:String(f.get('mandateDate'))}:{id:edit?.id||'',seasonId,name:String(f.get('name')),email:String(f.get('email')),phone:String(f.get('phone')),playerIds:f.getAll('playerIds')};
   if(await onAction(action,payload)){setEdit(null);setBank(false);if(!selected)close();}else setError('No se ha guardado. Revisa los datos y el aviso de la pantalla.');
  }finally{setBusy(false);}
 }
 const relatedAccounts=family?s.bankAccounts.filter(a=>s.playerSeasons.some(p=>p.id===a.playerSeasonId&&p.seasonId===seasonId&&family.players.some(c=>c.id===p.playerId))):[];
 const familyRows=families.filter(f=>found(f.title,...f.responsibles.flatMap(r=>[r.name,r.email,r.phone]),...f.players.map(p=>p.name)));
 const functions=(id:string):StaffFunction[]=>{const rows=s.staffFunctions.filter(f=>f.coachId===id);return rows.length?rows.filter(f=>f.active).map(f=>f.kind):['COACH'];};
 const scope:StaffFunction=section==='preparadores'?'PHYSICAL':section==='psicologia'?'PSYCHOLOGY':'COACH';
 const coachRows=s.coaches.filter(c=>functions(c.id).includes(scope)&&found(c.name,c.email,...assignments(c.id).map(a=>teamName(a.teamId))));
 useEffect(()=>setPage(0),[query,seasonId,section]);
 const count=isFamily?familyRows.length:coachRows.length;
 function child(p:Player,detail=false){return <button className={detail?'family-child-detail':'family-child'} key={p.id} onClick={()=>{close();onPlayer(p);}}><span><strong>{p.name}</strong><small>{teamName(s.playerSeasons.find(ps=>ps.playerId===p.id&&ps.seasonId===seasonId)?.teamId||null)}</small></span><ArrowUpRight size={17}/></button>;}
 return <div className='people-section'>
 {isFamily?<>
  <div className='people-toolbar'><span>{familyRows.length} familias y responsables</span>{editable?<button className='button' onClick={()=>{setSelected('');setEdit({});}}><Plus size={17}/>Alta de responsable</button>:null}</div>
  <div className='family-grid'>{familyRows.slice(page*12,page*12+12).map(f=><article className='family-card' key={f.id}>
   <button className='family-card-heading' onClick={()=>setSelected(f.id)}><span className='family-mark'>{f.self?<UserRound/>:<Users/>}</span><span><small>{f.self?'RESPONSABLE PROPIO':'FAMILIA CDIR'}</small><h2>{f.title}</h2><span>{f.responsibles.length} {f.responsibles.length===1?'responsable':'responsables'} · {f.players.length} {f.self?'jugador':'hijos en el club'}</span></span><ArrowUpRight size={20}/></button>
   <div className='family-contacts'>{f.responsibles.map(r=><div key={r.id}><strong>{r.name}</strong><span><Phone size={14}/>{r.phone||'Teléfono pendiente'}</span><span><Mail size={14}/>{r.email||'Correo pendiente'}</span></div>)}</div>
   <div className='family-children'>{f.players.map(p=>child(p))}{!f.players.length?<p>Responsable registrado. Vincula sus hijos desde la ficha.</p>:null}</div>
   <button className='family-card-footer' onClick={()=>setSelected(f.id)}>Ver ficha familiar <ArrowUpRight size={16}/></button>
  </article>)}</div>
 </>:<><div className='people-toolbar'><span>{coachRows.length} profesionales del club</span>{user.role==='ADMIN'&&section!=='entrenadores'?<ProfessionalCreate kind={scope} s={s} onAction={onAction}/>:null}{editable?<Link className='text-link' href='/usuarios'>Gestionar accesos <ArrowUpRight size={15}/></Link>:null}</div><div className='coach-people-grid'>{coachRows.slice(page*12,page*12+12).map(c=>{const rows=assignments(c.id),member=s.members.find(m=>m.email.toLowerCase()===c.email.toLowerCase()&&m.active);return <button className='coach-person-card' key={c.id} onClick={()=>setSelected(c.id)}>
  <div className='coach-card-cover'><img src='/logo.png' alt='CDIR'/><GraduationCap/></div><CoachPhoto id={c.id} large/>
  <div className='coach-card-copy'><span className='eyebrow'>EQUIPO TÉCNICO</span><h2>{c.name}</h2><p>{c.qualification||'Profesional del club'}</p><div className='coach-badges'>{functions(c.id).map(f=><span key={f}>{staffLabels[f]}</span>)}<span>{rows.length} {rows.length===1?'equipo':'equipos'}</span>{member?.role==='ADMIN'?<span><ShieldCheck size={13}/>Administrador</span>:null}</div><small>{rows.length?rows.map(a=>teamName(a.teamId)).join(' · '):'Sin equipos asignados esta temporada'}</small><span className='text-link'>Ver profesional <ArrowUpRight size={16}/></span></div>
 </button>;})}</div></>}
 {!count?<div className='empty'><Users/><h3>No hay coincidencias</h3><p>Prueba con otro nombre, apellido o equipo.</p></div>:null}
 {count>12?<div className='club-pagination'><button disabled={!page} onClick={()=>{setPage(page-1);window.scrollTo({top:0,behavior:'instant'});}}>Anterior</button><span>Página {page+1} de {Math.ceil(count/12)}</span><button disabled={(page+1)*12>=count} onClick={()=>{setPage(page+1);window.scrollTo({top:0,behavior:'instant'});}}>Siguiente</button></div>:null}
 <dialog ref={dialog} className='editor-dialog people-dialog' onCancel={e=>{e.preventDefault();close();}} aria-label={edit?'Datos del responsable':isFamily?'Ficha familiar':'Ficha del entrenador'}><button className='dialog-close icon-button' aria-label='Cerrar ficha' onClick={close}><X/></button>
 {edit?<form className='people-form' onSubmit={save} key={edit.id||'new'}><span className='eyebrow'>FAMILIAS · RESPONSABLE</span><h2>{edit.id?'Datos del responsable':'Primero, el responsable'}</h2><p>Registra al padre, madre o tutor. Después puedes vincular a sus hijos de esta temporada.</p>
  <label>Nombre y dos apellidos<input name='name' required defaultValue={edit.name}/></label><div className='people-form-row'><label>Correo electrónico<input name='email' type='email' defaultValue={edit.email}/></label><label>Teléfono<input name='phone' type='tel' defaultValue={edit.phone}/></label></div>
  <fieldset><legend>Hijos en el club · {s.seasons.find(x=>x.id===seasonId)?.name}</legend><div className='family-player-picker'>{s.players.filter(p=>s.playerSeasons.some(ps=>ps.playerId===p.id&&ps.seasonId===seasonId)).map(p=><label className='check-label' key={p.id}><input type='checkbox' name='playerIds' value={p.id} defaultChecked={s.guardianLinks.some(l=>l.guardianId===edit.id&&l.playerId===p.id&&l.seasonId===seasonId)}/><span>{p.name}<small>{teamName(s.playerSeasons.find(ps=>ps.playerId===p.id&&ps.seasonId===seasonId)?.teamId||null)}</small></span></label>)}</div></fieldset>
  <small>Los vínculos existentes se conservan; marcar un hijo añade su relación con este responsable.</small>{error?<p className='alert' role='alert'>{error}</p>:null}<button className='button' disabled={busy}>{busy?'Guardando…':'Guardar responsable'}</button>
 </form>:null}
 {!edit&&isFamily&&family?<>
  <div className='people-detail-heading'><span className='family-mark'><Users/></span><div><span className='eyebrow'>FICHA FAMILIAR</span><h2>{family.title}</h2><p>Responsables y {family.self?'jugador':'hijos'} · {s.seasons.find(x=>x.id===seasonId)?.name}</p></div></div>
  <section className='people-detail-section'><h3>Responsables</h3>{family.responsibles.map(r=><div className='responsible-detail' key={r.id}><strong>{r.name}</strong><a href={r.phone?'tel:'+r.phone:undefined}><Phone size={16}/>{r.phone||'Teléfono pendiente de completar'}</a><a href={r.email?'mailto:'+r.email:undefined}><Mail size={16}/>{r.email||'Correo pendiente de completar'}</a>{editable?<button className='text-link' onClick={()=>setEdit(r)}>Editar datos y vincular hijos <ArrowUpRight size={15}/></button>:null}</div>)}</section>
  <section className='people-detail-section'><h3>{family.self?'Jugador':'Hijos en el club'}</h3>{family.players.map(p=>child(p,true))}</section>
  {financial?<section className='people-detail-section'><h3><CreditCard size={19}/>Cuenta y domiciliación</h3>{relatedAccounts.map(a=><div className='bank-summary' key={a.id}><strong>{a.holder}</strong><span>IBAN · •••• •••• •••• •••• •••• {a.last4}</span><small>Mandato: {a.mandateReference} · {a.mandateDate}</small></div>)}{!relatedAccounts.length?<p>No hay cuenta registrada para los jugadores de esta familia en esta temporada.</p>:null}
   <button className='text-link' onClick={()=>setBank(!bank)}>{bank?'Cerrar formulario':'Registrar o actualizar cuenta'}<ArrowUpRight size={15}/></button>
   {bank?<form className='people-form' onSubmit={save}><label>Jugador<select name='playerSeasonId' required>{s.playerSeasons.filter(ps=>ps.seasonId===seasonId&&family.players.some(p=>p.id===ps.playerId)).map(ps=><option key={ps.id} value={ps.id}>{s.players.find(p=>p.id===ps.playerId)?.name}</option>)}</select></label><label>Titular<input name='holder' required/></label><label>Documento del titular<input name='holderDocument' required/></label><label>IBAN<input name='iban' required autoComplete='off'/></label><div className='people-form-row'><label>Referencia del mandato<input name='mandateReference' required/></label><label>Fecha del mandato<input name='mandateDate' type='date' required/></label></div><small>Se guarda cifrada. Guardar la cuenta no genera ningún cobro.</small>{error?<p className='alert'>{error}</p>:null}<button className='button' disabled={busy||!family.players.length}>{busy?'Guardando…':'Guardar cuenta'}</button></form>:null}
  </section>:null}
 </>:null}
 {!edit&&!isFamily&&coach?<>
 {editable?<form className='support-role-form' key={coach.id+'-'+s.staffFunctions.filter(f=>f.coachId===coach.id&&f.active).map(f=>f.kind).join()} onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onAction('staffFunctions',{coachId:coach.id,functions:new FormData(e.currentTarget).getAll('functions')});}finally{setBusy(false);}}}><fieldset><legend>Funciones en el club · Puede combinar varias</legend>{(['COACH','PHYSICAL','PSYCHOLOGY'] as const).map(f=><label className='check-label' key={f}><input type='checkbox' name='functions' value={f} defaultChecked={functions(coach.id).includes(f)}/>{staffLabels[f]}</label>)}</fieldset><button className='button secondary' disabled={busy}>Guardar funciones</button></form>:null}

  <div className='people-detail-heading'><CoachPhoto id={coach.id} large/><div><span className='eyebrow'>FICHA DEL PROFESIONAL</span><h2>{coach.name}</h2><p>{coach.qualification||'Profesional del club'}</p></div></div>
  <section className='people-detail-section'><h3>Contacto</h3><p><Mail size={16}/> {coach.email||'Correo pendiente'}</p><p><Phone size={16}/> {coach.phone||'Teléfono pendiente'}</p>{coach.email.toLowerCase()===user.email.toLowerCase()?<Link className='text-link' href='/perfil' onClick={close}>Cambiar mi foto de perfil <ArrowUpRight size={15}/></Link>:null}</section>
  {functions(coach.id).includes('COACH')?<section className='people-detail-section'><h3>{assignments(coach.id).length} equipos esta temporada</h3>{assignments(coach.id).map(a=><Link className='family-child-detail' key={a.id} href={'/equipos?team='+a.teamId} onClick={close}><span><strong>{teamName(a.teamId)}</strong><small>{a.function==='HEAD'?'Primer entrenador':'Segundo entrenador'}</small></span><ArrowUpRight/></Link>)}{!assignments(coach.id).length?<p>Está registrado como entrenador. Puedes asignarle equipos desde la ficha de cada equipo.</p>:null}</section>:null}<section className='people-detail-section'><h3>Horarios de apoyo de esta temporada</h3>{s.supportSessions.filter(x=>x.coachId===coach.id&&x.seasonId===seasonId).map(x=><Link className='family-child-detail' key={x.id} href={x.kind==='PHYSICAL'?'/sesiones-apoyo?support='+x.id:'/calendario'} onClick={close}><span><strong>{x.title}</strong><small>{staffLabels[x.kind]} · {new Date(x.startsAt).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})}</small></span><ArrowUpRight/></Link>)}<Link className='text-link' href='/sesiones-apoyo' onClick={close}>Gestionar horarios y sesiones <ArrowUpRight size={15}/></Link></section>
  <p className='people-note'><ShieldCheck size={17}/>Una persona puede combinar entrenamiento, preparación física y psicología. El acceso a la plataforma se autoriza en Usuarios.</p>
 </>:null}
 </dialog></div>;
}
