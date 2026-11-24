/** Isolated static showcase. Never reads .env, credentials or a database. */
import {cpSync,mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {syntheticClub} from '../tests/support/synthetic-club';
import {publicFeed,PUBLIC_SECTIONS} from '../src/domain/public-feed';
const root=resolve(import.meta.dirname,'..'),dest=join(root,'.pages-demo'),base='/cdir-admin-app';
mkdirSync(dest,{recursive:true});
for(const folder of ['components','domain','lib','data','types','generated'])if(existsSync(join(root,'src',folder)))cpSync(join(root,'src',folder),join(dest,'src',folder),{recursive:true});
mkdirSync(join(dest,'src/app'),{recursive:true});
for(const file of readdirSync(join(root,'src/app')))if(/\.css$/.test(file)||['layout.tsx','page.tsx'].includes(file))cpSync(join(root,'src/app',file),join(dest,'src/app',file));
cpSync(join(root,'public'),join(dest,'public'),{recursive:true});
cpSync(join(root,'scripts/pages-demo-client.ts'),join(dest,'src/lib/pages-demo-client.ts'));
// Only the generated showcase tree is adapted. Production keeps its server routes and authentication.
function adapt(dir:string){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory()){adapt(p);continue;}if(e.name==='pages-demo-client.ts'||!/\.(tsx?|css|json)$/.test(e.name))continue;let t=readFileSync(p,'utf8');
 t=t.replace(/import \{randomUUID\} from 'node:crypto';/g,'const randomUUID=()=>globalThis.crypto.randomUUID();');
 if(dir.includes('components')&&/\bfetch\(/.test(t))t=t.replace(/('use client';)/,"$1\nimport {demoFetch as fetch} from '@/lib/pages-demo-client';");
 t=t.replace(/(['"`(])\/(logo\.png|fonts\/|icons\/|archive\/|opponents\/|pdfjs\/)/g,`$1${base}/$2`);
 if(e.name==='client-auth.ts')t="export const firebaseReady=false; export async function authHeaders():Promise<Record<string,string>>{return {}}; export async function logout(){}; export async function googleLogin():Promise<{displayName:string}>{throw Error('Esta demo no utiliza cuentas reales.')}";
 if(e.name==='workspace.tsx'){t=t.replace('Entorno local','Demostración').replace('Entorno local','Demostración').replace('se guardan en este equipo','se guardan únicamente en este navegador');t=t.replace("return <div className={'app-shell", "return <div className={'app-shell");}
 if(e.name==='club-sections.tsx')t=t.replace("apiOrigin='' publicUrl=","apiOrigin='' assetBase='/cdir-admin-app' publicUrl=");
 writeFileSync(p,t);
}}
adapt(join(dest,'src'));
const sections=['clubes','jugadores','familias','equipos','entrenadores','preparadores','psicologia','sesiones-apoyo','temporadas','agenda','subidas','asistencia','eventos','inscripciones','formularios','economia','contenidos','usuarios','auditoria','perfil','calendario','partidos','solicitudes','notificaciones','privacidad','revistas','vida-club'];
mkdirSync(join(dest,'src/app/[section]'),{recursive:true});
writeFileSync(join(dest,'src/app/[section]/page.tsx'),`export function generateStaticParams(){return ${JSON.stringify(sections)}.map(section=>({section}));} export const dynamicParams=false;export default function Page(){return null;}`);
// Visible on every screen, including the shared link and role switch.
let layout=readFileSync(join(dest,'src/app/layout.tsx'),'utf8').replace("import AdminAppShell", "import DemoBar from '@/components/demo-bar';\nimport AdminAppShell").replace('<body>','<body><DemoBar/>');
writeFileSync(join(dest,'src/app/layout.tsx'),layout);
writeFileSync(join(dest,'src/app/admin-theme.css'),readFileSync(join(dest,'src/app/admin-theme.css'),'utf8')+'\n/* The showcase banner must not cover the fixed navigation. */\n.sidebar{top:40px;height:calc(100dvh - 40px)}\n@media(max-width:900px){.sidebar{top:80px;height:calc(100dvh - 80px)}}\n');
writeFileSync(join(dest,'src/components/demo-bar.tsx'),`'use client';export default function DemoBar(){return <div style={{background:'#00bed0',color:'#09223d',padding:'9px 20px',display:'flex',gap:16,alignItems:'center',justifyContent:'center',flexWrap:'wrap',fontSize:13,position:'relative',zIndex:100}}><strong>DEMOSTRACIÓN · DATOS FICTICIOS</strong><span>Los cambios solo se guardan en tu navegador.</span><select aria-label="Perfil de demostración" defaultValue="ADMIN" onChange={e=>{localStorage.setItem('cdir-pages-role',e.target.value);location.reload()}}><option value="ADMIN">Administración</option><option value="COACH">Entrenador</option></select><a href="https://basket-apps.github.io/front-cdir/" target="_blank" rel="noreferrer">Ver web pública ↗</a><button onClick={()=>{if(confirm('¿Restablecer los datos ficticios de esta demo?')){localStorage.removeItem('cdir-pages-state-v1');localStorage.removeItem('cdir-demo-public-feed-v1');location.reload()}}}>Restablecer demo</button></div>}`);
const s=syntheticClub();s.profiles=[];s.files=[];s.bankAccounts=[];s.audit=s.audit.slice(-60);
const current=s.seasons.find(x=>x.current)!.id;
s.sessions=s.sessions.filter(x=>x.seasonId===current);s.supportSessions=s.supportSessions.filter(x=>x.seasonId===current);
const sessionIds=new Set(s.sessions.map(x=>x.id)),supportIds=new Set(s.supportSessions.map(x=>x.id));
s.attendance=s.attendance.filter(x=>sessionIds.has(x.sessionId)).slice(-800);s.supportAttendance=s.supportAttendance.filter(x=>supportIds.has(x.sessionId));s.supportParticipants=s.supportParticipants.filter(x=>supportIds.has(x.sessionId));s.crossTrainings=s.crossTrainings.filter(x=>sessionIds.has(x.destinationSessionId));
const surnames=['García','Martín','López','Sánchez','Pérez','Fernández','Gómez','Ruiz','Moreno','Jiménez','Álvarez','Romero','Navarro','Torres','Domínguez','Gil','Serrano','Molina','Ortega','Delgado'];
const names=new Map<string,string>();function rename(n:string){if(!names.has(n)){const i=names.size;names.set(n,n.split(' ')[0]+' '+surnames[i%surnames.length]+' '+surnames[(Math.floor(i/20)+i*7+3)%surnames.length]);}return names.get(n)!;}
for(const rows of [s.players,s.guardians,s.coaches,s.members,s.applications])for(const p of rows)p.name=rename(p.name);
for(const p of [...s.players,...s.guardians,...s.coaches])p.phone='';
const rivals=['CB Las Rozas','Baloncesto Torrelodones','CB Pozuelo','CB Majadahonda','Baloncesto Alcobendas','Estudiantes','Distrito Olímpico','Baloncesto Fuenlabrada'];
s.matches.forEach((m,i)=>{m.opponent=rivals[i%rivals.length];m.location=m.venue==='HOME'?s.venues[i%5].name:'Pabellón rival · demostración';});
s.events.forEach((e,i)=>{e.title=['Campus de Navidad','Torneo de Semana Santa','Campus de verano','Jornada de puertas abiertas','Tecnificación'][i%5];e.description='Baloncesto, convivencia y actividades para disfrutar en equipo. Actividad de demostración.';e.location='Las Rozas';});
s.magazines.forEach((m,i)=>{m.title='Revista CDIR nº '+(i+1);m.description='Historias del club, equipos y momentos para recordar. Edición de demostración.';m.pdfPath=base+'/demo/revista.pdf';});
s.clubActivities.forEach((a,i)=>{a.title=['Fiesta del club','Encuentro de familias','Jornada de baloncesto inclusivo','Presentación de equipos'][i%4];a.description='Compartimos mucho más que baloncesto. Actividad de demostración.';});
mkdirSync(join(dest,'public/demo'),{recursive:true});
writeFileSync(join(dest,'public/demo/club.json'),JSON.stringify(s));
writeFileSync(join(dest,'public/demo/public-feed.json'),JSON.stringify(publicFeed(s,[...PUBLIC_SECTIONS],false)));
// A real, valid synthetic PDF: no real magazine or personal data is published.
const stream='BT /F1 32 Tf 65 730 Td (CDIR - Revista del club) Tj 0 -65 Td /F1 18 Tf (Edicion de demostracion) Tj 0 -45 Td (Baloncesto, equipo y comunidad.) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;writeFileSync(join(dest,'public/demo/revista.pdf'),pdf);
writeFileSync(join(dest,'next.config.ts'),`export default {output:'export',basePath:'${base}',trailingSlash:true,images:{unoptimized:true},experimental:{cpus:1},typescript:{tsconfigPath:'tsconfig.json'}};`);
writeFileSync(join(dest,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',lib:['dom','dom.iterable','esnext'],strict:true,skipLibCheck:true,noEmit:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'react-jsx',plugins:[{name:'next'}],paths:{'@/*':['./src/*']}},include:['next-env.d.ts','src/**/*.ts','src/**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));
writeFileSync(join(dest,'package.json'),JSON.stringify({name:'cdir-pages-demo',private:true}));
const env={...process.env,NEXT_PUBLIC_CDIR_DEMO:'true',NEXT_PUBLIC_CDIR_PUBLIC_URL:'https://basket-apps.github.io/front-cdir',NEXT_TELEMETRY_DISABLED:'1'};
for(const k of Object.keys(env))if(k.startsWith('NEXT_PUBLIC_FIREBASE_'))delete env[k];
const result=spawnSync(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'build',dest,'--webpack'],{cwd:root,env,stdio:'inherit'});
if(result.status===0){
 // Next static segment requests use flattened names; GitHub Pages has no rewrite server.
 function flatten(dir:string,parent:string,prefix:string){for(const e of readdirSync(dir,{withFileTypes:true})){const file=join(dir,e.name),name=prefix+'.'+e.name;if(e.isDirectory())flatten(file,parent,name);else if(e.name.endsWith('.txt'))cpSync(file,join(parent,name));}}
 function segments(dir:string){for(const e of readdirSync(dir,{withFileTypes:true}))if(e.isDirectory()){const p=join(dir,e.name);if(e.name.startsWith('__next.'))flatten(p,dir,e.name);else segments(p);}}
 segments(join(dest,'out'));
}
process.exit(result.status??1);
