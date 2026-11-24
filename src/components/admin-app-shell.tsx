'use client';
import {usePathname} from 'next/navigation';
import Workspace from './workspace';
const sections=new Set(['clubes','jugadores','familias','equipos','entrenadores','preparadores','psicologia','sesiones-apoyo','temporadas','agenda','subidas','asistencia','eventos','inscripciones','formularios','economia','contenidos','usuarios','auditoria','perfil','calendario','partidos','solicitudes','notificaciones','privacidad','revistas','vida-club']);
export default function AdminAppShell({children}:{children:React.ReactNode}){const path=usePathname(),section=path==='/'?'inicio':path.replace(/^\//,'').replace(/\/$/,'');return section==='inicio'||sections.has(section)?<Workspace section={section}/>:children;}

