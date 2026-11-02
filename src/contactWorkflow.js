export const ROLE_TYPES=Object.freeze(['Consultant','Individual Contributor','Leadership']);
export const HIRING_STAGES=Object.freeze(['Applied','Recruiter Interview','Submitted','HR Interview','Hiring Interview']);
export const POSITION_STATUSES=Object.freeze(['Awaiting Decision','On-hold','Rejected','Closed','Hired']);
const fields={role_category:ROLE_TYPES,hiring_stage:HIRING_STAGES,position_status:POSITION_STATUSES};
const labels={role_category:'Role Type',hiring_stage:'Hiring Workflow',position_status:'Position Status'};
const key=value=>String(value??'').trim().toLowerCase();

// Omission is distinct from an explicit clear: older clients must not erase
// canonical fields they do not know about.
export function normalizeWorkflowPatch(input){
  const values={},errors=[];
  for(const [field,choices] of Object.entries(fields)){
    if(!Object.hasOwn(input,field))continue;
    const raw=input[field];
    if(raw===null||raw===''){values[field]=null;continue;}
    if(typeof raw!=='string'){errors.push(labels[field]+' must be text.');continue;}
    const value=raw.trim();
    if(!value){values[field]=null;continue;}
    if(!choices.includes(value)){errors.push('Choose a valid '+labels[field]+'.');continue;}
    values[field]=value;
  }
  return {values,errors,valid:errors.length===0};
}

// Used only for justified migration defaults, never to overwrite explicit
// canonical values or to discard the legacy role_type/status evidence.
export function legacyWorkflowDefaults(record){
  const role=ROLE_TYPES.find(value=>key(value)===key(record.role_type))??null;
  const status=key(record.status);
  const stage=({'applied':'Applied','submitted':'Submitted'})[status]??null;
  const position=({'awaiting decision':'Awaiting Decision','on hold':'On-hold','on-hold':'On-hold',
    rejected:'Rejected',closed:'Closed',hired:'Hired'})[status]??null;
  return {
    role_category:record.role_category??role,
    hiring_stage:record.hiring_stage??stage,
    position_status:record.position_status??position
  };
}
