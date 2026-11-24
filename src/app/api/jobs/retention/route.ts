import {timingSafeEqual} from 'node:crypto';
import {transaction} from '@/server/store';
import {retentionReminders} from '@/domain/club-operations';
export async function POST(request:Request){const secret=process.env.RETENTION_JOB_SECRET,value=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';if(!secret||Buffer.byteLength(secret)!==Buffer.byteLength(value)||!timingSafeEqual(Buffer.from(secret),Buffer.from(value)))return new Response('Sin acceso',{status:401});await transaction(s=>retentionReminders(s));return Response.json({ok:true});}
