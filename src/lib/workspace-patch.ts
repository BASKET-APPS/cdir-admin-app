import type {PublicState} from '@/domain/types';
/** Applies the rows returned by a scoped command (insert or replace by id). */
export function mergePatch(state:PublicState,patch:Record<string,{id:string}[]>):PublicState{
 const next={...state} as unknown as Record<string,{id:string}[]>;
 for(const [key,rows] of Object.entries(patch)){const current=next[key];if(!Array.isArray(current)||!rows.length)continue;const byId=new Map(rows.map(r=>[r.id,r]));const merged=current.map(r=>byId.get(r.id)??r);const known=new Set(current.map(r=>r.id));for(const r of rows)if(!known.has(r.id))merged.push(r);next[key]=merged;}
 return next as unknown as PublicState;
}
