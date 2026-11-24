import {notFound} from 'next/navigation';
const sections=['clubes','jugadores','familias','equipos','entrenadores','preparadores','psicologia','sesiones-apoyo','temporadas','agenda','subidas','asistencia','eventos','inscripciones','formularios','economia','contenidos','usuarios','auditoria','perfil','calendario','partidos','solicitudes','notificaciones','privacidad','revistas','vida-club'];
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.includes(section))notFound();return null;}
