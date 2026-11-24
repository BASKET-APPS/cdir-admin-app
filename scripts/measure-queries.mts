// Estimación reproducible (sin red ni datos reales) del volumen leído de SQL Connect por operación.
// Genera un club SINTÉTICO a partir del contrato de tablas y calcula, para cada operación, cuántas
// consultas GraphQL se envían y cuántos bytes de filas (JSON) devuelven, antes y después de los cambios.
// Uso: npx tsx scripts/measure-queries.mts [factor]   (factor multiplica el número de filas, por defecto 1)
import contract from '../src/generated/sql-connect-contract.json' with {type:'json'};
type C=Record<string,{fields:Record<string,string>}>;
const factor=Number(process.argv[2]||1);
// Supuesto de "club mediano" en temporada (modificable). No procede de la base real.
const rows:Record<string,number>={seasons:3,teams:60,players:350,guardians:450,playerSeasons:900,guardianLinks:900,coaches:40,coachTeams:120,venues:8,sessions:1200,crossTrainings:200,attendance:8000,forms:6,events:15,applications:120,invoices:900,bankAccounts:300,contents:30,members:45,audit:4000,files:200,profiles:45,categories:12,teamDetails:60,playerDetails:350,matches:600,playerRequests:150,requestPlayers:400,notifications:1500,magazines:8,clubActivities:20,coachDetails:40,staffFunctions:50,supportSessions:300,supportParticipants:600,supportAttendance:1500};
const AVATARS=30,AVATAR_BYTES=26_000; // perfiles con foto subida (WebP 320 px en base64)
const text:Record<string,number>={description:220,body:900,detail:70,title:40,name:22,email:26,address:40,reason:60,decisionNote:40,opponent:24,location:30,competition:18,url:50,imageUrl:60,photoUrl:60,pdfPath:60,googlePhotoUrl:90,ibanEncrypted:120,holderDocument:60};
const value=(field:string,type:string,i:number)=>{if(type.startsWith('UUID'))return '00000000-0000-4000-8000-'+String(i).padStart(12,'0');if(type.startsWith('[UUID'))return [];if(type.startsWith('Timestamp'))return '2026-11-02T10:00:00.000Z';if(type.startsWith('Date'))return '2026-11-02';if(type.startsWith('Boolean'))return i%2===0;if(type.startsWith('Int')||type.startsWith('Float'))return 42;if(type.startsWith('Any'))return {campo_1:'x'.repeat(20)};if(type.startsWith('[String'))return ['u1','u2'];return 'x'.repeat(text[field]??12);};
const table=(key:string,fields?:string[],count=Math.round((rows[key]??0)*factor),filter=(_:number)=>true)=>{const c=(contract as C)[key];let bytes=0,n=0;for(let i=0;i<count;i++){if(!filter(i))continue;n++;const row:Record<string,unknown>={};for(const [f,t] of Object.entries(c.fields))if(!fields||fields.includes(f))row[f]=key==='profiles'&&f==='avatarPath'?(i<AVATARS?'data:image/webp;base64,'+'A'.repeat(AVATAR_BYTES):null):value(f,t,i);bytes+=JSON.stringify(row).length+1;}return {bytes,n};};
const all=(omitAvatar=false)=>Object.keys(contract).reduce((sum,k)=>sum+table(k,omitAvatar&&k==='profiles'?Object.keys((contract as C)[k].fields).filter(f=>f!=='avatarPath'):undefined).bytes,0);
const pages=Math.max(1,...Object.keys(contract).map(k=>Math.ceil(Math.round((rows[k]??0)*factor)/500)));
const snapshot=(omit:boolean)=>({queries:2+pages,bytes:all(omit)});
const identity=(withAvatar:boolean)=>({queries:1,bytes:1200+(withAvatar?AVATAR_BYTES:0)});
const add=(...xs:{queries:number;bytes:number}[])=>xs.reduce((a,b)=>({queries:a.queries+b.queries,bytes:a.bytes+b.bytes}),{queries:0,bytes:0});
const published=(k:string,f:string[],share=0.6)=>table(k,f,undefined,i=>i<Math.round((rows[k]??0)*factor*share)).bytes;
const feedNew={queries:1,bytes:published('events',['id','seasonId','title','slug','kind','description','location','startsAt','endsAt','capacity','price','status','registrationOpen','formId','imageUrl'],0.5)+published('matches',['id','seasonId','teamId','startsAt','endsAt','opponent','venue','location','competition','status','scoreFor','scoreAgainst','published','isExample'],0.8)+table('teams',['id','name']).bytes+table('seasons',['id','name']).bytes+published('magazines',['id','title','description','pdfPath','publishedAt','published','isExample'],0.75)+published('clubActivities',['id','title','description','startsAt','location','imageUrl','published','isExample'],0.7)};
const matchesOnly={queries:1,bytes:published('matches',['id','seasonId','teamId','startsAt','endsAt','opponent','venue','location','competition','status','scoreFor','scoreAgainst','published','isExample'],0.8)+table('teams',['id','name']).bytes+table('seasons',['id','name']).bytes};
const pdf=900_000,coverJpeg=140_000,b64=(n:number)=>Math.ceil(n/3)*4;
const ops:[string,{queries:number;bytes:number},{queries:number;bytes:number}][]=[
 ['GET /api/public/club (sin caché)',snapshot(false),feedNew],
 ['GET /api/public/club?sections=matches',snapshot(false),matchesOnly],
 ['GET /api/public/club con caché de 30 s (100 visitas/min)',{queries:snapshot(false).queries*100,bytes:snapshot(false).bytes*100},{queries:2,bytes:feedNew.bytes*2}],
 ['GET /api/workspace (administrador)',add(identity(true),snapshot(false)),add(identity(false),snapshot(true))],
 ['GET /api/profile/avatar',add(identity(true),snapshot(false)),add(identity(false),{queries:1,bytes:1500+AVATAR_BYTES})],
 ['GET /api/coaches/:id/avatar',add(identity(true),snapshot(false)),add(identity(false),{queries:2,bytes:table('members',['id','uid','name','email','role','teamIds','active']).bytes+400+AVATAR_BYTES})],
 ['POST /api/profile syncGoogle (<24 h, ya es entrenador)',add(identity(true),identity(true),snapshot(false)),add(identity(false),identity(false))],
 ['Portada revista ya generada (PDF de 0,9 MB sin fragmentar)',{queries:2,bytes:b64(pdf)+b64(coverJpeg)},{queries:2,bytes:300+b64(coverJpeg)}],
 ['Portada revalidada (304)',{queries:2,bytes:b64(pdf)+b64(coverJpeg)},{queries:1,bytes:300}],
 ['PDF revalidado (304)',{queries:1,bytes:b64(pdf)},{queries:1,bytes:300}],
];
const fmt=(n:number)=>n>=1e6?(n/1e6).toFixed(2)+' MB':n>=1e3?(n/1e3).toFixed(1)+' kB':n+' B';
console.log(`Club sintético (factor ${factor}), ${pages} página(s) por instantánea. Bytes = JSON de filas devueltas por SQL Connect.`);
console.log('| Operación | Consultas antes | Bytes antes | Consultas después | Bytes después |');console.log('|---|---:|---:|---:|---:|');
for(const [name,before,after] of ops)console.log(`| ${name} | ${before.queries} | ${fmt(before.bytes)} | ${after.queries} | ${fmt(after.bytes)} |`);
