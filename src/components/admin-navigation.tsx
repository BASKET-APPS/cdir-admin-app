'use client';

import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {LayoutDashboard,Users,Layers,CalendarDays,Globe2,Settings2,Wallet,ChevronDown,ChevronRight,PanelLeftClose,PanelLeftOpen,LogOut,X,ArrowUpRight} from 'lucide-react';
import UserAvatar from './user-avatar';
import type {Identity} from '@/domain/types';

export const navigationGroups=[
 {id:'personas',label:'Personas',description:'Jugadores, familias y entrenadores',icon:Users,items:[['jugadores','Jugadores'],['familias','Familias'],['entrenadores','Entrenadores'],['preparadores','Preparadores físicos'],['psicologia','Psicología']]},
 {id:'deporte',label:'Equipos',description:'Plantillas y entrenamientos',icon:Layers,items:[['equipos','Equipos'],['sesiones-apoyo','Físico y psicología'],['partidos','Partidos y resultados'],['clubes','Clubes de Madrid'],['agenda','Entrenamientos y pistas'],['solicitudes','Solicitudes de jugadores'],['subidas','Histórico de subidas'],['asistencia','Asistencia']]},
 {id:'actividades',label:'Inscripciones',description:'Solicitudes y formularios de actividades',icon:CalendarDays,items:[['inscripciones','Inscripciones'],['formularios','Formularios']]},
 {id:'web',label:'Web pública',description:'Noticias y contenidos del club',icon:Globe2,items:[['contenidos','Contenidos'],['eventos','Campus y eventos'],['revistas','Revistas del club'],['vida-club','Vida del club']]},
 {id:'gestion',label:'Administración',description:'Calendario, economía y temporadas',icon:Wallet,items:[['calendario','Calendario'],['economia','Economía'],['temporadas','Temporadas']]},
 {id:'ajustes',label:'Configuración',description:'Accesos y registro de actividad',icon:Settings2,items:[['usuarios','Usuarios y permisos'],['notificaciones','Notificaciones'],['privacidad','Bajas y privacidad'],['auditoria','Registro de actividad']]},
] as const;

export function currentNavigationGroup(section:string){return navigationGroups.find(g=>g.items.some(([key])=>key===section));}
export function sectionLabel(section:string){return section==='perfil'?'Mi perfil':section==='inicio'?'Inicio':currentNavigationGroup(section)?.items.find(([key])=>key===section)?.[1]||'Administración';}

type Props={section:string;allowed:string[];pending:number;collapsed:boolean;mobile:boolean;user:Identity;onCollapse:()=>void;onClose:()=>void;onSignOut:()=>void};
export default function AdminNavigation({section,allowed,pending,collapsed,mobile,user,onCollapse,onClose,onSignOut}:Props){
 const activeGroup=currentNavigationGroup(section)?.id||null;
 const [openGroup,setOpenGroup]=useState<string|null>(activeGroup);
 const navRef=useRef<HTMLElement>(null),buttons=useRef<Record<string,HTMLButtonElement|null>>({});
 useEffect(()=>{setOpenGroup(collapsed?null:activeGroup);},[section,collapsed,activeGroup]);
 useEffect(()=>{if(!collapsed||!openGroup)return;const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!navRef.current?.contains(event.target))setOpenGroup(null);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[collapsed,openGroup]);
 function dismissFlyout(event:React.KeyboardEvent){if(event.key==='Escape'&&openGroup){event.preventDefault();buttons.current[openGroup]?.focus();setOpenGroup(null);}}
 const visible=navigationGroups.map(g=>({...g,label:g.id==='gestion'&&user.role!=='ADMIN'?'Mi agenda':g.label,visible:g.items.filter(([key])=>allowed.includes(key))})).filter(g=>g.visible.length);
 return <aside ref={navRef} className={'sidebar club-navigation '+(mobile?'open':'')} aria-label='Menú lateral' onKeyDown={dismissFlyout}>
  <div className='navigation-brand-row'><Link className='brand' href='/' aria-label='CDIR Administración, inicio' onClick={onClose}><img src='/logo.png' alt='' width='52' height='44'/><span>CDIR<small>ADMINISTRACIÓN</small></span></Link><button className='nav-mobile-close' onClick={onClose} aria-label='Cerrar menú'><X size={19}/></button></div>
  <div className='navigation-caption'><span className='live-dot'/>TU CLUB, EN UN SOLO LUGAR</div>
  <nav aria-label='Administración' className='grouped-navigation'>
   <Link href='/' className={'nav-home '+(section==='inicio'?'active':'')} title={collapsed?'Inicio':undefined} aria-label='Inicio' aria-current={section==='inicio'?'page':undefined} onClick={()=>{onClose();setOpenGroup(null);}}><LayoutDashboard size={19}/><span>Inicio</span></Link>
   <div className='nav-groups'>{visible.map(group=>{
    const Icon=group.icon,active=activeGroup===group.id,open=openGroup===group.id;
    const count=group.id==='actividades'?pending:0;
    return <div key={group.id} className={'nav-section '+(active?'current':'')+(open?' expanded':'')}>
     <button ref={el=>{buttons.current[group.id]=el;}} className='nav-section-trigger' aria-expanded={open} aria-controls={'nav-'+group.id} aria-label={group.label} title={collapsed?group.label:undefined} onClick={()=>setOpenGroup(open?null:group.id)}>
      <span className='nav-section-icon'><Icon size={20}/>{count>0?<i aria-hidden='true'/>:null}</span><span className='nav-section-name'>{group.label}</span>{count>0?<b className='nav-count' aria-label={count+' inscripciones pendientes'}>{count}</b>:null}<ChevronDown className='nav-group-chevron' size={14}/>
     </button>
     {open?<div className='nav-section-panel' id={'nav-'+group.id}><div className='nav-flyout-heading'><strong>{group.label}</strong><small>{group.description}</small></div>{group.visible.map(([key,label])=><Link key={key} href={'/'+key} className={section===key?'active':''} aria-current={section===key?'page':undefined} onClick={()=>{onClose();if(collapsed)setOpenGroup(null);}}><span>{label}</span>{section===key?<span className='nav-current-mark'/>:key==='inscripciones'&&pending>0?<b className='nav-count'>{pending}</b>:<ChevronRight size={13}/>}</Link>)}</div>:null}
    </div>;
   })}</div>
  </nav>
  <div className='navigation-bottom'>
   <a className='public-site-link' href='https://basket-apps.github.io/front-cdir/' target='_blank' rel='noopener noreferrer' aria-label='Ver web pública de CDIR' title={collapsed?'Ver web pública':undefined}><Globe2 size={17}/><span>Ver web pública</span><ArrowUpRight size={15}/></a>
   <button className='collapse-sidebar' onClick={()=>{setOpenGroup(null);onCollapse();}} aria-label={collapsed?'Expandir menú lateral':'Contraer menú lateral'} title={collapsed?'Expandir menú':'Contraer menú'}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}<span>Contraer menú</span></button>
   <div className='navigation-user'><Link href='/perfil' className='navigation-profile-link' aria-label='Mi perfil' title='Mi perfil' onClick={onClose}><UserAvatar user={user}/><span><strong>{user.name}</strong><small>Mi perfil</small></span></Link><button onClick={onSignOut} aria-label='Cerrar sesión' title='Cerrar sesión'><LogOut size={17}/></button></div>
  </div>
 </aside>;
}
