import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {identity} from '@/server/auth';
import {requirePermission} from '@/domain/permissions';
import {audit} from '@/domain/commands';
import {transaction} from '@/server/store';
import {storageBucket} from '@/server/firebase';
import {demoMode} from '@/server/mode';
import {failure} from '@/server/http';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const u=await identity(request);requirePermission(u,'people');const {id}=await params;const {file,bytes}=await transaction(async s=>{const f=s.files.find(x=>x.id===id);if(!f)throw new Error('Documento no encontrado.');const data=demoMode()?await readFile(path.join(process.cwd(),'.local','files',f.id)):(await storageBucket().file(f.storagePath).download())[0];audit(s,u,'file.download','Descarga autorizada de documento privado');return {file:f,bytes:data};});return new Response(new Uint8Array(bytes),{headers:{'Content-Type':file.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}catch(e){return failure(e);}}
