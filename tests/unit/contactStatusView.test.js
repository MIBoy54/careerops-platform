import { describe, it, expect } from 'vitest';
import { STAGES, POSITIONS, contactDimensions, summarizeContacts, filterContacts, sortContacts, badgeTone } from '../../src/contactStatusView.js';
const records = [
 {id:1,company:'Alpha',date_contacted:'2026-11-03',hiring_stage:'Applied',position_status:'Awaiting Decision',reported_unemployment:'No'},
 {id:2,company:'Alpha',date_contacted:'2026-11-03T00:00:00.000Z',hiring_stage:'Submitted',position_status:'Awaiting Decision',reported_unemployment:'Yes'},
 {id:3,company:'Beta',date_contacted:'2026-11-02',hiring_stage:'HR Interview',position_status:'Hired'},
 {id:4,company:'Legacy',date_contacted:null,status:'Offer'},
 {id:5,company:'Unknown',date_contacted:'bad',hiring_stage:'unexpected',position_status:null,status:'Rejected'},
 {id:6,company:'Legacy applied',date_contacted:'2026-02-30',status:'Applied',reported_to_unemployment:'yes'}
];
describe('independent contact distributions',()=>{
 it('counts every record exactly once in each group, including unknowns and reported records',()=>{
  const result=summarizeContacts(records);
  expect(result.total).toBe(6);
  for(const key of ['stage','position','reported'])expect(Object.values(result[key]).reduce((a,b)=>a+b,0)).toBe(result.total);
  expect(result.stage.Applied).toBe(2);
  expect(result.position['Awaiting Decision']).toBe(2);
  expect(result.position.Unclassified).toBe(3);
  expect(result.reported.Reported).toBe(2);
 });
 it('every category count equals its filtered record set',()=>{
  const result=summarizeContacts(records);
  for(const key of ['stage','position','reported'])for(const [value,count] of Object.entries(result[key]))expect(filterContacts(records,{[key]:value})).toHaveLength(count);
  expect(filterContacts(records)).toHaveLength(6);
  expect(filterContacts(records,{stage:'Submitted',position:'Awaiting Decision',reported:'Reported'}).map(r=>r.id)).toEqual([2]);
 });
 it('preserves ambiguous history and explicit clears without mutating records',()=>{
  const before=structuredClone(records);
  expect(contactDimensions(records[3])).toMatchObject({stage:'Unclassified',position:'Unclassified'});
  expect(contactDimensions(records[4]).position).toBe('Unclassified');
  expect(contactDimensions({status:'Rejected'}).position).toBe('Rejected');
  summarizeContacts(records);filterContacts(records);sortContacts(records);
  expect(records).toEqual(before);
 });
 it('keeps records with matching companies and dates visible',()=>expect(filterContacts(records).filter(r=>r.company==='Alpha')).toHaveLength(2));
});
describe('sorting and presentation',()=>{
 it('sorts displayed dimensions rather than stale legacy status',()=>{
  const rows=[{id:1,hiring_stage:'Hiring Interview',status:'Applied'},{id:2,hiring_stage:'Applied',status:'Hired'}];
  expect(sortContacts(rows,'stage','asc').map(r=>r.id)).toEqual([2,1]);
  expect(sortContacts(rows,'stage','desc').map(r=>r.id)).toEqual([1,2]);
  expect(sortContacts(records,'position','asc').slice(0,2).map(r=>r.id)).toEqual([1,2]);
 });
 it('uses chronological dates, deterministic ties, and invalid dates last in both directions',()=>{
  expect(sortContacts(records).map(r=>r.id)).toEqual([1,2,3,4,6,5]);
  expect(sortContacts(records,'date_contacted','asc').slice(0,3).map(r=>r.id)).toEqual([3,1,2]);
  expect(sortContacts([...records].reverse()).map(r=>r.id)).toEqual(sortContacts(records).map(r=>r.id));
 });
 it('supports company and reporting sorts',()=>{
  expect(sortContacts(records,'company','asc')[0].company).toBe('Alpha');
  expect(sortContacts(records,'company','desc')[0].company).toBe('Unknown');
  expect(sortContacts(records,'reported','desc').slice(0,2).map(r=>r.id)).toEqual([2,6]);
 });
 it('provides a tone for all supported labels and unknowns',()=>{
  for(const label of [...STAGES,...POSITIONS,'Reported','Not Reported'])expect(badgeTone(label)).toMatch(/^(blue|teal|purple|amber|gray|red|slate|green)$/);
  expect(badgeTone('Hired')).toBe('green');expect(badgeTone('Awaiting Decision')).toBe('amber');
 });
});
