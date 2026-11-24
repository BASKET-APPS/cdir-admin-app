import 'server-only';
import {createHash} from 'node:crypto';
// Per-instance cache for PUBLIC responses only (never identity- or permission-dependent data).
// - Simultaneous requests share one database read.
// - A write made by this instance clears it immediately (invalidatePublicCache).
// - With SQL Connect every entry remembers the global revision it was built from. After
//   PUBLIC_FEED_REVISION_CHECK_SECONDS (default 5) one tiny revision query decides whether it is still
//   valid, so a write made by ANOTHER instance is visible here within that interval.
// - Without a revision source (local adapters), entries expire after PUBLIC_FEED_CACHE_SECONDS (default 30).
// PUBLIC_FEED_CACHE_SECONDS=0 disables the cache.
type Entry={at:number;checkedAt:number;generation:number;revision:number|null;value:Promise<CachedBody>;refresh?:Promise<CachedBody>};
export type CachedBody={body:string;etag:string};
const g=globalThis as unknown as {cdirPublicCache?:Map<string,Entry>;cdirPublicGeneration?:number};
const cache=()=>g.cdirPublicCache??=new Map();
const seconds=(name:string,fallback:number,max:number)=>{const raw=Number(process.env[name]??fallback);return Number.isFinite(raw)&&raw>0?Math.min(raw,max)*1000:0;};
export function publicCacheTtl(){return seconds('PUBLIC_FEED_CACHE_SECONDS',30,300);}
export function revisionCheckInterval(){return seconds('PUBLIC_FEED_REVISION_CHECK_SECONDS',5,60)||5000;}
/** With a revision source an entry can live longer, but never more than this without being rebuilt. */
const MAX_AGE=10*60*1000;
export function invalidatePublicCache(){g.cdirPublicGeneration=(g.cdirPublicGeneration||0)+1;cache().clear();}
export function etagFor(body:string|Uint8Array){return '"'+createHash('sha256').update(body).digest('base64url').slice(0,32)+'"';}
export async function cachedPublicJson(key:string,load:()=>Promise<unknown>,revision?:()=>Promise<number>):Promise<CachedBody>{
 const ttl=publicCacheTtl(),generation=g.cdirPublicGeneration||0,now=Date.now(),hit=cache().get(key);
 const encode=(data:unknown)=>{const body=JSON.stringify(data);return {body,etag:etagFor(body)};};
 const build=(knownRevision?:number)=>{
  const entry:Entry={at:now,checkedAt:now,generation,revision:null,value:Promise.resolve({body:'',etag:''})};
  // Store the promise before awaiting revision/load: cold concurrent requests share both reads.
  entry.value=Promise.resolve().then(async()=>{entry.revision=revision?(knownRevision??await revision()):null;return encode(await load());});
  if((g.cdirPublicGeneration||0)===generation)cache().set(key,entry);
  entry.value.catch(()=>{if(cache().get(key)===entry)cache().delete(key);});
  for(const [k,v] of cache())if(now-v.at>=(revision?MAX_AGE:ttl))cache().delete(k);
  return entry.value;
 };
 if(!ttl)return encode(await load());
 if(ttl&&hit&&hit.generation===generation){
  if(!revision){if(now-hit.at<ttl)return hit.value;}
  else if(now-hit.at<MAX_AGE){if(now-hit.checkedAt<revisionCheckInterval())return hit.value;
   if(hit.refresh)return hit.refresh;
   hit.refresh=(async()=>{const current=await revision();if(current===hit.revision){hit.checkedAt=now;return hit.value;}return build(current);})().finally(()=>{hit.refresh=undefined;});
   return hit.refresh;
  }
 }
 return build();
}
/** True when the browser/CDN copy is still valid. */
export function notModified(request:Request|undefined,etag:string){const header=request?.headers.get('if-none-match');return !!header&&header.split(',').map(x=>x.trim().replace(/^W\//,'')).includes(etag);}
