import {z} from 'zod';
import type {Identity,State} from './types';
const input=z.object({name:z.string().trim().min(2).max(200),email:z.string().trim().toLowerCase().pipe(z.email()),role:z.enum(['ADMIN','COACH']),staffFunctions:z.array(z.enum(['COACH','PHYSICAL','PSYCHOLOGY'])).min(1).max(3)}).strict();
/** IDs are resolved from the loaded records; SQL Connect rechecks all authority and concurrency. */
export async function memberVariables(s:State,actor:Identity,payload:unknown,version:number){
 if(actor.role!=='ADMIN')throw Error('Solo administración puede autorizar cuentas.');
 const d=input.parse(payload),old=s.members.find(m=>m.email.toLowerCase()===d.email);
 if(old?.uid===actor.uid&&d.role!=='ADMIN')throw Error('No puedes retirar tu propio rol de administración.');
 const coach=s.coaches.find(c=>c.email.toLowerCase()===d.email),coachId=coach?.id||crypto.randomUUID();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(d.email)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const kindId=(kind:string)=>s.staffFunctions.find(f=>f.coachId===coachId&&f.kind===kind)?.id||crypto.randomUUID();
 return {memberId:old?.id||crypto.randomUUID(),uid:old?.uid||'invite:'+hash,name:d.name,email:d.email,role:d.role,coachId,coachName:coach?.name||d.name,phone:coach?.phone||'',qualification:coach?.qualification||'',coachFunctionId:kindId('COACH'),physicalFunctionId:kindId('PHYSICAL'),psychologyFunctionId:kindId('PSYCHOLOGY'),coach:d.staffFunctions.includes('COACH'),physical:d.staffFunctions.includes('PHYSICAL'),psychology:d.staffFunctions.includes('PSYCHOLOGY'),version,next:version+1};
}
