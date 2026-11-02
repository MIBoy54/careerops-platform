import {describe,it,expect} from 'vitest';
import {ROLE_TYPES,HIRING_STAGES,POSITION_STATUSES,normalizeWorkflowPatch,legacyWorkflowDefaults} from '../../src/contactWorkflow.js';
describe('approved contact workflow contract',()=>{
 it('accepts every approved role, hiring stage and independent position state',()=>{
  for(const role_category of ROLE_TYPES)for(const hiring_stage of HIRING_STAGES)for(const position_status of POSITION_STATUSES){
   const input={role_category,hiring_stage,position_status};
   expect(normalizeWorkflowPatch(input)).toEqual({values:input,errors:[],valid:true});
  }
 });
 it('distinguishes an omitted field from an explicit clear',()=>{
  expect(normalizeWorkflowPatch({status:'Applied'}).values).toEqual({});
  expect(normalizeWorkflowPatch({hiring_stage:null,position_status:''}).values).toEqual({hiring_stage:null,position_status:null});
 });
 it('refuses unsupported classifications and non-text values',()=>{
  expect(normalizeWorkflowPatch({role_category:'QE Transformation',hiring_stage:'Interviewing',position_status:'Offer'}).errors).toHaveLength(3);
  expect(normalizeWorkflowPatch({position_status:{value:'Hired'}}).valid).toBe(false);
 });
 it('does not guess ambiguous legacy categories or hiring outcomes',()=>{
  for(const status of ['Interviewing','Offer']){
   const record={role_type:'QE Transformation',status};
   const before={...record};
   expect(legacyWorkflowDefaults(record)).toEqual({role_category:null,hiring_stage:null,position_status:null});
   expect(record).toEqual(before);
  }
 });
 it('maps only known legacy facts and preserves explicit canonical values',()=>{
  expect(legacyWorkflowDefaults({role_type:'Leadership',status:'Submitted'})).toEqual({role_category:'Leadership',hiring_stage:'Submitted',position_status:null});
  expect(legacyWorkflowDefaults({status:'On hold'}).position_status).toBe('On-hold');
  expect(legacyWorkflowDefaults({status:'Rejected'}).position_status).toBe('Rejected');
  expect(legacyWorkflowDefaults({status:'Offer',role_category:'Consultant',hiring_stage:'HR Interview',position_status:'Hired'}))
   .toEqual({role_category:'Consultant',hiring_stage:'HR Interview',position_status:'Hired'});
 });
});
