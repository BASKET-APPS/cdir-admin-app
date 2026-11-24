import path from 'node:path';
import {spawnSync} from 'node:child_process';
const pgBin=process.env.POSTGRES_BIN||'C:/Program Files/PostgreSQL/18/bin';
const cluster=path.join(process.cwd(),'.local','postgres');
const r=spawnSync(path.join(pgBin,process.platform==='win32'?'pg_ctl.exe':'pg_ctl'),['-D',cluster,'-m','fast','-w','stop'],{windowsHide:true,encoding:'utf8',timeout:30000});
if(r.status!==0)throw new Error('No se ha podido detener el cluster local o ya estaba detenido. No se han borrado archivos.');
console.log('PostgreSQL local detenido; los datos se conservan.');
