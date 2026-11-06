export const ROLE_TYPES=Object.freeze(['Consultant','Individual Contributor','Leadership']);
export const HIRING_STAGES=Object.freeze(['Applied','Recruiter Interview','Submitted','HR Interview','Hiring Interview','Offer Letter']);
export const POSITION_STATUSES=Object.freeze(['Accepted','Awaiting Decision','Closed','Ghosted','Hired','On-hold','Rejected']);
export const INTERVIEW_STAGES=Object.freeze(['Recruiter Interview','HR Interview','Hiring Interview']);
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
  if (Object.hasOwn(input, 'interview_date')) {
    const value = input.interview_date;
    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00Z') : null;
    if (value === null || value === '') values.interview_date = null;
    else if (date && Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) >= 1000) values.interview_date = value;
    else errors.push('Choose a valid interview date.');
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

export function compatibilityStatusForCreate(input){
  if(Object.hasOwn(input,'status'))return input.status||null;
  const position=input.position_status,stage=input.hiring_stage;
  if(['Hired','Rejected','Closed'].includes(position))return position;
  if(position==='On-hold')return 'On hold';
  if(stage==='Applied'||stage==='Submitted')return stage;
  if(['Recruiter Interview','HR Interview','Hiring Interview'].includes(stage))return 'Interviewing';
  return position==='Awaiting Decision'?'Awaiting decision':null;
}
export function contactStatusBucket(contact){
  const position=key(contact.position_status),stage=key(contact.hiring_stage);
  if(position==='hired')return 'hired';
  if(position==='rejected'||position==='closed')return 'rejectedClosed';
  if(position==='on-hold')return 'onHold';
  if(['recruiter interview','hr interview','hiring interview'].includes(stage))return 'interviewing';
  if(stage==='applied'||stage==='submitted')return 'appliedSubmitted';
  if(position==='awaiting decision')return 'awaitingDecision';
  const legacy=key(contact.status);
  if(legacy==='hired')return 'hired';
  if(legacy==='rejected'||legacy==='closed')return 'rejectedClosed';
  if(legacy==='on hold'||legacy==='on-hold')return 'onHold';
  if(legacy==='awaiting decision')return 'awaitingDecision';
  if(legacy==='interviewing')return 'interviewing';
  if(legacy==='applied'||legacy==='submitted')return 'appliedSubmitted';
  if(legacy==='offer'||legacy==='accepted')return 'legacyOutcome';
  return 'unclassified';
}
export function contactWorkflowLabel(contact){
  return [contact.hiring_stage,contact.position_status].filter(Boolean).join(' · ')||
    contact.status||'Unclassified';
}
