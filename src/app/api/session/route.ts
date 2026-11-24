import {NextResponse} from 'next/server';
import {identity,demoCookie} from '@/server/auth';
import {demoMode,localRequest,sameOrigin} from '@/server/mode';
import {failure} from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request){let user=null;try{user=await identity(request);}catch{}return Response.json({mode:demoMode()?'demo':'firebase',user},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){try{sameOrigin(request);if(!demoMode()||!localRequest(request))throw new Error('El acceso de prueba no está disponible.');const response=NextResponse.json({ok:true});response.cookies.set('cdir_demo',demoCookie(),{httpOnly:true,sameSite:'strict',secure:false,path:'/',maxAge:8*3600});return response;}catch(e){return failure(e);}}
export async function DELETE(request:Request){try{sameOrigin(request);const response=NextResponse.json({ok:true});response.cookies.set('cdir_demo','',{httpOnly:true,sameSite:'strict',path:'/',maxAge:0});return response;}catch(e){return failure(e);}}
