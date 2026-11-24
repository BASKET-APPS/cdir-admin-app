import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
if(!process.env.DATABASE_URL||!process.env.FIREBASE_PROJECT_ID||!process.env.ADMIN_EMAIL)throw new Error('Configura DATABASE_URL, FIREBASE_PROJECT_ID y ADMIN_EMAIL.');
initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID});
const user=await getAuth().getUserByEmail(process.env.ADMIN_EMAIL);if(!user.emailVerified)throw new Error('La cuenta debe tener correo verificado. Inicia sesión con Google primero.');
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:true}:undefined});
try{await p.query(`INSERT INTO members(id,uid,name,email,role,"teamIds",active) VALUES($1,$2,$3,$4,'ADMIN','{}',true) ON CONFLICT(uid) DO UPDATE SET active=true,role='ADMIN'`,[randomUUID(),user.uid,user.displayName||'Administración',user.email]);console.log('Cuenta administrativa autorizada.');}finally{await p.end();}
