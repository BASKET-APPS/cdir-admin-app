import type {State} from './types';
// Optimistic checks for edits made from a screen that may be out of date.
// The browser sends what it showed for the edited record; the server compares it with the stored value
// inside the same transaction. Same function on both sides, so the comparison is exact.
export class ConflictError extends Error{status=409;}
export const SAME_RECORD_MESSAGE='Otra persona ha cambiado este mismo dato mientras lo editabas. Se muestra el valor actual: revísalo y vuelve a guardar si sigue siendo necesario.';
type Payload=Record<string,unknown>;
export function expectationFor(s:Pick<State,'attendance'|'matches'>,action:string,payload:unknown):Record<string,unknown>|undefined{
 const p=(payload||{}) as Payload;
 if(action==='attendance'){const a=s.attendance.find(x=>x.sessionId===p.sessionId&&x.playerSeasonId===p.playerSeasonId);return {status:a?.status??null};}
 if(action==='matchResult'){const m=s.matches.find(x=>x.id===p.id);return m?{status:m.status,scoreFor:m.scoreFor,scoreAgainst:m.scoreAgainst}:undefined;}
 return undefined;
}
/** Throws ConflictError when the stored record no longer matches what the user saw. */
export function assertExpected(s:Pick<State,'attendance'|'matches'>,action:string,payload:unknown,expected:unknown){
 if(expected===undefined||expected===null)return;
 const current=expectationFor(s,action,payload);if(!current)return;
 for(const [k,v] of Object.entries(expected as Payload))if(k in current&&current[k]!==v)throw new ConflictError(SAME_RECORD_MESSAGE);
}
