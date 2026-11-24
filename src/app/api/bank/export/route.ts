import {identity} from '@/server/auth';
import {transaction} from '@/server/store';
import {bankCsv} from '@/server/bank';
import {sameOrigin} from '@/server/mode';
import {failure,boundedJson} from '@/server/http';
export async function POST(request:Request){try{sameOrigin(request);const u=await identity(request),body=await boundedJson(request);const csv=await transaction(s=>bankCsv(s,u,body.seasonId));return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="cdir-cuentas.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return failure(e);}}
