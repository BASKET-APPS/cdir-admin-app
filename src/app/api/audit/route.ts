import {identity} from '@/server/auth';
import {failure} from '@/server/http';
import {readAuditPage} from '@/server/scoped-store';
export const runtime='nodejs';
// Composite cursor: ?before=<timestamp>&beforeId=<UUID>. Non-admins only see their own rows.
export async function GET(request:Request){try{
 const user=await identity(request),params=new URL(request.url).searchParams,raw=params.get('before'),id=params.get('beforeId');
 const before=raw&&!Number.isNaN(Date.parse(raw))?new Date(raw).toISOString():null;
 if((raw&&!before)||(id&&(!before||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))))throw Error('El cursor de auditoría no es válido.');
 const page=await readAuditPage(user,before,id?.toLowerCase()||null);return Response.json(page,{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
