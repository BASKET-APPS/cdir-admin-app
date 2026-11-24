import {getApps,initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut} from 'firebase/auth';
const config={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID,storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID};
export const firebaseReady=!!(config.apiKey&&config.authDomain&&config.projectId&&config.appId);
export function clientAuth(){if(!firebaseReady)throw new Error('Configura Firebase para habilitar Google.');return getAuth(getApps().find(x=>x.name==='cdir-admin-client')||initializeApp(config,'cdir-admin-client'));}
export async function googleLogin(){return (await signInWithPopup(clientAuth(),new GoogleAuthProvider())).user;}
export async function logout(){if(firebaseReady)await signOut(clientAuth());}
export async function authHeaders():Promise<Record<string,string>>{if(!firebaseReady)return {};await clientAuth().authStateReady();const u=clientAuth().currentUser;return u?{Authorization:'Bearer '+await u.getIdToken()}:{};}
