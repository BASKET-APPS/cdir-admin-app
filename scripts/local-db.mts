/** Creates an isolated, persistent PostgreSQL cluster for development only. */
import {readFile,writeFile,mkdir,access,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {Pool} from 'pg';
import {demoState} from '../src/domain/seed';

const root=process.cwd(),local=path.join(root,'.local'),cluster=path.join(local,'postgres'),connectionFile=path.join(local,'postgres-local.json');
const pgBin=process.env.POSTGRES_BIN||'C:/Program Files/PostgreSQL/18/bin';
const port=55433,database='cdir_club_local',username='cdir_local_owner';
if(process.env.NODE_ENV==='production')throw new Error('El generador local no se ejecuta en producción.');
if(process.env.DATABASE_URL){const url=new URL(process.env.DATABASE_URL);if(url.hostname!=='127.0.0.1'||url.pathname!=='/'+database||url.port!==String(port))throw new Error('Ya existe otra conexión configurada. No se modificará.');}
await mkdir(local,{recursive:true});
let existing=false;try{await access(path.join(cluster,'PG_VERSION'));existing=true;}catch{}
let password:string;
if(existing){const saved=JSON.parse(await readFile(connectionFile,'utf8'));password=saved.password;if(saved.port!==port||saved.database!==database)throw new Error('La configuración del cluster local no coincide.');}
else{password=randomBytes(32).toString('base64url');await writeFile(connectionFile,JSON.stringify({port,database,username,password}),{flag:'wx',mode:0o600});}
function pg(name:string,args:string[],allowError=false){const exe=path.join(pgBin,name+(process.platform==='win32'?'.exe':''));const r=spawnSync(exe,args,{windowsHide:true,stdio:'ignore',timeout:30000});if(r.error)throw new Error('No se pudo ejecutar '+name+'. Configura POSTGRES_BIN con la carpeta de PostgreSQL.');if(r.status!==0&&!allowError)throw new Error(name+' no pudo completar la operación. Consulta .local/postgres.log; no se han borrado datos.');return r.status;}
if(!existing){const secretFile=path.join(local,'postgres-init-password');await writeFile(secretFile,password,{flag:'wx',mode:0o600});try{pg('initdb',['-D',cluster,'-U',username,'--encoding=UTF8','--locale=C','--auth-host=scram-sha-256','--auth-local=scram-sha-256','--pwfile='+secretFile]);}finally{await unlink(secretFile).catch(()=>{});}console.log('Cluster PostgreSQL local creado, separado de las bases del equipo.');}
if(pg('pg_ctl',['-D',cluster,'status'],true)!==0){pg('pg_ctl',['-D',cluster,'-l',path.join(local,'postgres.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);console.log('PostgreSQL escuchando solo en 127.0.0.1:'+port+'.');}
const admin=new Pool({host:'127.0.0.1',port,user:username,password,database:'postgres'});
try{const exists=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database]);if(!exists.rowCount)await admin.query('CREATE DATABASE cdir_club_local');}finally{await admin.end();}
const connectionString=`postgresql://${username}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`;
process.env.DATABASE_URL=connectionString;process.env.DB_SSL='false';
await import('./migrate.mjs');
const pool=new Pool({connectionString}),client=await pool.connect();
try{
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(91732001)');
 const existingData=await client.query('SELECT count(*)::int AS count FROM seasons');
 if(existingData.rows[0].count===0){
  // Preserve any existing local demonstration records instead of silently resetting them.
  let state=demoState();try{const saved=JSON.parse(await readFile(path.join(local,'workspace.json'),'utf8'));state={...state,...saved,profiles:saved.profiles||[]};}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const tables={seasons:'seasons',teams:'teams',players:'players',guardians:'guardians',playerSeasons:'player_seasons',guardianLinks:'guardian_links',coaches:'coaches',coachTeams:'coach_teams',venues:'venues',sessions:'sessions',crossTrainings:'cross_trainings',attendance:'attendance',forms:'forms',events:'events',applications:'applications',invoices:'invoices',bankAccounts:'bank_accounts',contents:'contents',members:'members',audit:'audit_logs',files:'files',profiles:'user_profiles'};
  for(const [key,table] of Object.entries(tables))for(const row of state[key as keyof typeof state]){const data=row as unknown as Record<string,unknown>,fields=Object.keys(data);await client.query(`INSERT INTO ${table} (${fields.map(f=>'"'+f+'"').join(',')}) VALUES(${fields.map((_,i)=>'$'+(i+1)).join(',')})`,fields.map(f=>['fields','answers'].includes(f)?JSON.stringify(data[f]):data[f]));}
  console.log('Datos ficticios guardados en PostgreSQL. Se conserva el fichero JSON anterior.');
 }else console.log('Base existente conservada; no se han sobrescrito registros.');
 await client.query('COMMIT');
}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
const envPath=path.join(root,'.env.local');let lines:string[]=[];try{lines=(await readFile(envPath,'utf8')).split(/\r?\n/);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
for(const [key,value] of Object.entries({DATABASE_URL:connectionString,DB_SSL:'false',CDIR_MODE:'demo'})){const at=lines.findIndex(line=>line.startsWith(key+'='));if(at>=0)lines[at]=key+'='+value;else lines.push(key+'='+value);}
await writeFile(envPath,lines.join('\n').trimEnd()+'\n',{mode:0o600});
console.log('Base cdir_club_local preparada y conexión local configurada.');
console.log('La aplicación usa PostgreSQL real, con acceso local de prueba. No se ha creado Cloud SQL ni cambiado Firebase.');
