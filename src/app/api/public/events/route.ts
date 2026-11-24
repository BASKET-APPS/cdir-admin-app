import {publicEvent} from '@/domain/commands';
import {demoMode} from '@/server/mode';
import {failure} from '@/server/http';
import {readPublicSlice} from '@/server/public-data';
export async function GET(request:Request){try{const slug=new URL(request.url).searchParams.get('slug')||undefined;const s=await readPublicSlice(['events'],{registration:true,contents:true,slug});return Response.json({events:publicEvent(s,slug).map(e=>({...e,registrationOpen:e.registrationOpen&&(demoMode()||process.env.PUBLIC_REGISTRATION_ENABLED==='true')})),contents:s.contents.filter(c=>c.status==='PUBLISHED').map(({id,kind,title,body,url})=>({id,kind,title,body,url}))},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
