import {createHash} from 'node:crypto';
export const WORKFLOW_COLUMNS=Object.freeze({role_category:32,hiring_stage:40,position_status:40});
export async function inspectContactWorkflow(connection,expectedDatabase){
  const [[identity]]=await connection.query('SELECT DATABASE() AS db, @@server_uuid AS serverUuid');
  if(identity.db!==expectedDatabase)throw new Error('Workflow migration database mismatch');
  const [columns]=await connection.query(
    'SELECT COLUMN_NAME,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,IS_NULLABLE FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',
    ['recruiter_tracker']);
  const byName=new Map(columns.map(column=>[column.COLUMN_NAME,column]));
  if(!byName.has('role_type')||!byName.has('status'))throw new Error('Expected legacy contact schema missing');
  for(const [name,length] of Object.entries(WORKFLOW_COLUMNS)){
    const column=byName.get(name);
    if(column&&(column.DATA_TYPE!=='varchar'||Number(column.CHARACTER_MAXIMUM_LENGTH)!==length||column.IS_NULLABLE!=='YES'))
      throw new Error('Incompatible workflow column: '+name);
  }
  const [roles]=await connection.query('SELECT role_type AS value,COUNT(*) AS count FROM recruiter_tracker GROUP BY role_type');
  const [statuses]=await connection.query('SELECT status AS value,COUNT(*) AS count FROM recruiter_tracker GROUP BY status');
  return {database:identity.db,serverUuid:identity.serverUuid,missing:Object.keys(WORKFLOW_COLUMNS).filter(name=>!byName.has(name)),roles,statuses};
}
export async function migrateContactWorkflow(connection,{expectedDatabase,confirmation}){
  if(confirmation!=='add-contact-workflow:'+expectedDatabase)throw new Error('Explicit workflow migration confirmation required');
  const before=await inspectContactWorkflow(connection,expectedDatabase);
  await connection.query('SET SESSION lock_wait_timeout=5, innodb_lock_wait_timeout=10');
  if(before.missing.length){
    await connection.query('ALTER TABLE recruiter_tracker '+
      before.missing.map(name=>'ADD COLUMN `'+name+'` VARCHAR('+WORKFLOW_COLUMNS[name]+') NULL').join(', ')+', ALGORITHM=INSTANT');
  }
  await connection.beginTransaction();
  try{
    const [original]=await connection.query('SELECT id,role_type,status FROM recruiter_tracker ORDER BY id FOR UPDATE');
    const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    const updates={};
    for(const [field,sql] of [
      ['role_category',`UPDATE recruiter_tracker SET role_category=CASE LOWER(TRIM(role_type))
        WHEN 'consultant' THEN 'Consultant' WHEN 'individual contributor' THEN 'Individual Contributor'
        WHEN 'leadership' THEN 'Leadership' END
        WHERE role_category IS NULL AND LOWER(TRIM(role_type)) IN ('consultant','individual contributor','leadership')`],
      ['hiring_stage',`UPDATE recruiter_tracker SET hiring_stage=CASE LOWER(TRIM(status))
        WHEN 'applied' THEN 'Applied' WHEN 'submitted' THEN 'Submitted' END
        WHERE hiring_stage IS NULL AND LOWER(TRIM(status)) IN ('applied','submitted')`],
      ['position_status',`UPDATE recruiter_tracker SET position_status=CASE LOWER(TRIM(status))
        WHEN 'awaiting decision' THEN 'Awaiting Decision' WHEN 'on hold' THEN 'On-hold'
        WHEN 'on-hold' THEN 'On-hold' WHEN 'rejected' THEN 'Rejected'
        WHEN 'closed' THEN 'Closed' WHEN 'hired' THEN 'Hired' END
        WHERE position_status IS NULL AND LOWER(TRIM(status)) IN ('awaiting decision','on hold','on-hold','rejected','closed','hired')`]
    ]){
      if(!before.missing.includes(field)){updates[field]=0;continue;}
      const [result]=await connection.query(sql);updates[field]=result.affectedRows;
    }
    const [after]=await connection.query('SELECT id,role_type,status FROM recruiter_tracker ORDER BY id');
    if(digest(original)!==digest(after))throw new Error('Legacy contact evidence changed; backfill rolled back');
    await connection.commit();
    return {database:before.database,serverUuid:before.serverUuid,addedColumns:before.missing,updated:updates,
      contacts:original.length,legacyDigest:digest(after),legacyValuesPreserved:true};
  }catch(error){await connection.rollback();throw error;}
}
