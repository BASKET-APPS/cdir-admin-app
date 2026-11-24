// EXPERIMENT ONLY. Not imported by the application and not a deployed API.
import {readConsistentLists,sqlConnect} from '../../src/server/sql-connect-store';
import {submitApplication} from '../../src/domain/commands';
import {workspaceMutation} from '../../src/domain/sql-connect';
export async function prototypeRegistration(payload:any){
 const {state,version}=await readConsistentLists([
  {key:'events',where:'{id: {eq: $event}}'},
  {key:'forms'},
  {key:'applications',where:'{_or: [{eventId: {eq: $event}}, {requestKey: {eq: $request}}]}'},
 ],{definitions:'$event: UUID!, $request: UUID!',values:{event:payload.eventId,request:payload.requestKey}});
 const before=structuredClone(state),id=submitApplication(state,payload);
 const mutation=workspaceMutation(before,state,version);
 if(mutation)await sqlConnect().executeGraphql(mutation.query,{variables:mutation.variables});
 return Response.json({id},{status:201});
}
