// Pure helpers for the read-only deployment validator. Never log personal values or identifiers.
type Row=Record<string,unknown>;
type View=Record<string,unknown>;
export type Difference={table:string;missing:number;extra:number;changed:number;duplicates:number};
function canonical(value:unknown):unknown{
 if(value instanceof Date)return value.toISOString();
 if(typeof value==='string'){
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();
  if(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))return value.toLowerCase();
 }
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
 return value;
}
export function compareViews(expected:View,actual:View):Difference[]{
 const differences:Difference[]=[];
 for(const table of new Set([...Object.keys(expected),...Object.keys(actual)])){
  if(!Array.isArray(expected[table])&&!Array.isArray(actual[table]))continue;
  const a=(expected[table]||[]) as Row[],b=(actual[table]||[]) as Row[];
  const index=(rows:Row[])=>new Map(rows.map(r=>[JSON.stringify(canonical(r.id)),r]));
  const ai=index(a),bi=index(b);
  const missing=[...ai.keys()].filter(id=>!bi.has(id)).length,extra=[...bi.keys()].filter(id=>!ai.has(id)).length;
  const changed=[...ai].filter(([id,row])=>bi.has(id)&&JSON.stringify(canonical(row))!==JSON.stringify(canonical(bi.get(id)))).length;
  const duplicates=a.length-ai.size+b.length-bi.size;
  if(missing||extra||changed||duplicates)differences.push({table,missing,extra,changed,duplicates});
 }
 return differences;
}
// Both views must belong to the same global revision. A changing database is inconclusive, not a pass.
export async function compareStableViews<T extends {expected:View;actual:View}>(revision:()=>Promise<number>,read:()=>Promise<T>,attempts=3){
 for(let attempt=1;attempt<=attempts;attempt++){
  const before=await revision(),views=await read(),after=await revision();
  if(before===after)return {status:'stable' as const,revision:after,attempt,views,differences:compareViews(views.expected,views.actual)};
 }
 return {status:'changing' as const,attempt:attempts};
}
