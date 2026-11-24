import {it,expect} from 'vitest';
import {emptyState} from '../../src/domain/types';
import {FakeSqlConnect} from '../support/fake-sql-connect';

it('rejects mixed logical and season fields even when the table is empty',async()=>{
 const db=new FakeSqlConnect(emptyState());
 for(const where of ['{seasonId: {eq: "season"}, _or: [{requestedBy: {eq: "coach"}}]}','{request: {seasonId: {eq: "season"}, _or: [{requestedBy: {eq: "coach"}}]}}']){
  const root=where.includes('request:')?'requestPlayers':'playerRequests';
  await expect(db.executeGraphqlRead(`query { ${root}(where: ${where}) {id} }`)).rejects.toThrow('cannot mix');
 }
});

it('accepts explicit conjunctions with logical filters, including relations',async()=>{
 const db=new FakeSqlConnect(emptyState());
 const filter='{_and: [{seasonId: {eq: "season"}}, {_or: [{requestedBy: {eq: "coach"}}, {teamId: {eq: "team"}}]}]}';
 await expect(db.executeGraphqlRead(`query { playerRequests(where: ${filter}) {id} requestPlayers(where: {request: ${filter}}) {id} }`)).resolves.toEqual({data:{playerRequests:[],requestPlayers:[]}});
});
