import {transaction} from '@/server/store';
import {submitApplication} from '@/domain/commands';
import {boundedJson,failure} from '@/server/http';
import {sameOrigin,demoMode} from '@/server/mode';
const recent=new Map<string,{count:number;at:number}>();
export async function POST(request:Request){try{sameOrigin(request);if(!demoMode()&&process.env.PUBLIC_REGISTRATION_ENABLED!=='true')return Response.json({message:'Las inscripciones reales todavía no están habilitadas.'},{status:503});const key=request.headers.get('x-forwarded-for')?.split(',')[0]||'local';const now=Date.now();for(const [k,v] of recent)if(now-v.at>60000)recent.delete(k);const entry=recent.get(key)||{count:0,at:now};entry.count++;recent.set(key,entry);if(entry.count>10)return Response.json({message:'Espera un minuto antes de volver a enviar.'},{status:429});const body=await boundedJson(request);const id=await transaction(s=>submitApplication(s,body));return Response.json({id,message:demoMode()?'Solicitud ficticia guardada en el entorno local.':'Solicitud recibida para revisiÃ³n. No confirma plaza.'},{status:201,headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
