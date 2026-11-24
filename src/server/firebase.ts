import 'server-only';
import {applicationDefault,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getStorage} from 'firebase-admin/storage';
export function adminApp(){if(!process.env.FIREBASE_PROJECT_ID)throw new Error('Configura el proyecto Firebase nuevo.');return getApps().find(a=>a.name==='cdir-admin')||initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID,storageBucket:process.env.FIREBASE_STORAGE_BUCKET},'cdir-admin');}
export function serverAuth(){return getAuth(adminApp());}
export function storageBucket(){if(process.env.FIREBASE_STORAGE_ENABLED!=='true')throw new Error('El almacenamiento de archivos del club todavía no está activado.');if(!process.env.FIREBASE_STORAGE_BUCKET)throw new Error('Configura el almacenamiento privado.');return getStorage(adminApp()).bucket();}
