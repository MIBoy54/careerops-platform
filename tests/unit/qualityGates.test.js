import {describe,it,expect,vi} from 'vitest';
import {latestQualityGates,createQualityGateLoader} from '../../src/qualityGates.js';
const run=(status='completed',conclusion='success')=>({status,conclusion,head_sha:'abcdef012345',run_number:10,
 run_started_at:'2026-11-02T12:00:00Z',updated_at:'2026-11-02T12:01:00Z',display_title:'Fixture run'});
describe('latest push quality gate per environment',()=>{
 it('fetches each promotion branch independently and preserves latest pending/failure states',async()=>{
  const listWorkflowRuns=vi.fn(async({branch})=>({data:{workflow_runs:[run(branch==='qa'?'queued':'completed',branch==='main'?'failure':'success')]}}));
  const rows=await latestQualityGates({actions:{listWorkflowRuns}});
  expect(rows.map(r=>r.environment)).toEqual(['DEV','QA','DEMO','PROD']);
  expect(rows.map(r=>r.status)).toEqual(['success','queued','success','failure']);
  expect(rows[1].duration).toBeNull();
  for(const [args] of listWorkflowRuns.mock.calls){expect(args.event).toBe('push');expect(args.per_page).toBe(1);expect(args.workflow_id).toBe('careerops-ci.yml');}
 });
 it('keeps available environments when one branch fails or has no push run',async()=>{
  const listWorkflowRuns=async({branch})=>{
   if(branch==='qa')throw Error('private transport detail');
   return {data:{workflow_runs:branch==='demo'?[]:[run()]}};
  };
  const rows=await latestQualityGates({actions:{listWorkflowRuns}});
  expect(rows.map(r=>r.status)).toEqual(['success','unavailable','unknown','success']);
  expect(JSON.stringify(rows)).not.toContain('private transport');
 });
});

it('shares concurrent reads and refreshes after cache expiry',async()=>{
 let clock=0;
 const listWorkflowRuns=vi.fn(async()=>({data:{workflow_runs:[run()]}}));
 const load=createQualityGateLoader({actions:{listWorkflowRuns}},{cacheMs:100,now:()=>clock});
 const [a,b]=await Promise.all([load(),load()]);
 expect(a).toEqual(b);expect(listWorkflowRuns).toHaveBeenCalledTimes(4);
 await load();expect(listWorkflowRuns).toHaveBeenCalledTimes(4);
 clock=101;await load();expect(listWorkflowRuns).toHaveBeenCalledTimes(8);
});
