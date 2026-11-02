const environments=[['DEV','develop'],['QA','qa'],['DEMO','demo'],['PROD','main']];
export async function latestQualityGates(octokit,now=Date.now){
  return Promise.all(environments.map(async([environment,branch])=>{
    const empty={environment,branch,status:'unavailable',workflow:'CI status unavailable',commit:'—',completedAt:null,duration:null,runNumber:null};
    try{
      const response=await octokit.actions.listWorkflowRuns({
        owner:'MIBoy54',repo:'careerops-platform',workflow_id:'careerops-ci.yml',
        branch,event:'push',per_page:1
      });
      const run=response.data.workflow_runs[0];
      if(!run)return {...empty,status:'unknown',workflow:'No push runs available'};
      const status=run.status==='completed'?(run.conclusion||'unknown'):run.status;
      const start=Date.parse(run.run_started_at);
      const finish=run.status==='completed'?Date.parse(run.updated_at):now();
      const duration=!['queued','waiting','pending','requested'].includes(status)&&Number.isFinite(start)&&Number.isFinite(finish)
        ?Math.max(0,Math.floor((finish-start)/1000))+'s':null;
      return {environment,branch,status,workflow:run.display_title||run.name||'CareerOps CI',
        runNumber:run.run_number,commit:String(run.head_sha||'').slice(0,7)||'—',
        completedAt:run.run_started_at||run.created_at||null,duration};
    }catch{return empty;}
  }));
}

export function createQualityGateLoader(octokit,{cacheMs=60000,now=Date.now}={}){
  let cached,expires=0,pending;
  return async()=>{
    if(cached&&now()<expires)return cached;
    if(!pending)pending=latestQualityGates(octokit,now).then(rows=>{
      const checkedAt=new Date(now()).toISOString();
      cached=rows.map(row=>({...row,checkedAt}));expires=now()+cacheMs;return cached;
    }).finally(()=>{pending=null;});
    return pending;
  };
}
