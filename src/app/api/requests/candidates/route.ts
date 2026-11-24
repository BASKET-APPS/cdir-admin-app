import {z} from 'zod';
import {identity} from '@/server/auth';
import {readCandidatesState} from '@/server/scoped-store';
import {failure} from '@/server/http';
import {requestCandidates} from '@/domain/request-candidates';
export const runtime='nodejs';
export async function GET(request:Request){try{const user=await identity(request),params=Object.fromEntries(new URL(request.url).searchParams),input=z.object({requestId:z.string().uuid().optional(),teamId:z.string().uuid().optional(),kind:z.enum(['MATCH','TRAINING']).optional(),targetId:z.string().uuid().optional()}).parse(params);return Response.json({players:requestCandidates(await readCandidatesState(input),user,input)},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
