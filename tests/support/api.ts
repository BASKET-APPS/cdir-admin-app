// Helpers to call the real API routes as a given synthetic user (requires the mocks declared in each test file).
export const ORIGIN='http://127.0.0.1:3002';
export type Who={uid:string;email:string};
export const auth=(u:Who)=>'Bearer '+u.uid+'|'+u.email;
export const getReq=(url:string,u:Who)=>new Request(ORIGIN+url,{headers:{authorization:auth(u)}});
export const postReq=(url:string,u:Who,body:unknown)=>new Request(ORIGIN+url,{method:'POST',headers:{authorization:auth(u),origin:ORIGIN,'content-type':'application/json'},body:JSON.stringify(body)});
export function setupEnv(){process.env.CDIR_DATABASE='sql-connect';process.env.FIREBASE_PROJECT_ID='cdir-apps';process.env.APP_ORIGIN=ORIGIN;process.env.PUBLIC_FEED_CACHE_SECONDS='0';}
