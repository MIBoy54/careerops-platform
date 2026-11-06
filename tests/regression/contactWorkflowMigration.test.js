import {afterEach,beforeEach,describe,it,expect} from 'vitest';
import mysql from 'mysql2/promise';
import {migrateContactWorkflow} from '../../src/contactWorkflowMigration.js';
import {migrateWorkflowDates} from '../../src/contactWorkflowDatesMigration.js';
import {ageAwaitingContacts} from '../../src/contactWorkflowAging.js';
const suite=process.env.WORKFLOW_TEST_MYSQL==='1'?describe:describe.skip;
let admin,db,database,sequence=0;
suite('isolated MySQL workflow migration',()=>{
 beforeEach(async()=>{
  database='careerops_workflow_fixture_'+process.pid+'_'+(++sequence);
  admin=await mysql.createConnection({host:'127.0.0.1',user:'root',password:''});
  await admin.query('CREATE DATABASE '+database);
  db=await mysql.createConnection({host:'127.0.0.1',user:'root',password:'',database});
  await db.query('CREATE TABLE recruiter_tracker (id INT PRIMARY KEY AUTO_INCREMENT,role_type VARCHAR(100),status VARCHAR(50),notes TEXT) ENGINE=InnoDB');
  await db.query('INSERT INTO recruiter_tracker (role_type,status,notes) VALUES ?',[[
   ['QE Transformation','Interviewing','preserve 1'],['Leadership','Submitted','preserve 2'],
   [null,'Offer','preserve 3'],['Consultant','On hold','preserve 4'],
   ['Individual Contributor','Awaiting decision','preserve 5'],['Leadership','Hired','preserve 6']
  ]]);
 });
 afterEach(async()=>{
  await db?.end();
  if(admin&&database?.startsWith('careerops_workflow_fixture_'))await admin.query('DROP DATABASE '+database);
  await admin?.end();
 });
 const apply=()=>migrateContactWorkflow(db,{expectedDatabase:database,confirmation:'add-contact-workflow:'+database});
 it('adds nullable fields and backfills only known facts without changing legacy values',async()=>{
  const [before]=await db.query('SELECT * FROM recruiter_tracker ORDER BY id');
  const result=await apply();expect(result.addedColumns).toHaveLength(3);expect(result.legacyValuesPreserved).toBe(true);
  const [legacy]=await db.query('SELECT id,role_type,status,notes FROM recruiter_tracker ORDER BY id');expect(legacy).toEqual(before);
  const [rows]=await db.query('SELECT role_category,hiring_stage,position_status FROM recruiter_tracker ORDER BY id');
  expect(rows).toEqual([
   {role_category:null,hiring_stage:null,position_status:null},
   {role_category:'Leadership',hiring_stage:'Submitted',position_status:null},
   {role_category:null,hiring_stage:null,position_status:null},
   {role_category:'Consultant',hiring_stage:null,position_status:'On-hold'},
   {role_category:'Individual Contributor',hiring_stage:null,position_status:'Awaiting Decision'},
   {role_category:'Leadership',hiring_stage:null,position_status:'Hired'}
  ]);
 });
 it('ages only eligible records from their recorded stage entry dates',async()=>{
  await apply();
  const migrate=()=>migrateWorkflowDates(db,{expectedDatabase:database,confirmation:'add-workflow-dates:'+database});
  expect((await migrate()).addedColumns).toEqual(['stage_entered_at','interview_date']);
  expect((await migrate()).addedColumns).toEqual([]);
  for (const [id,stage,status,days] of [[1,'Applied','Awaiting Decision',60],[2,'Submitted','Awaiting Decision',45],[3,'Applied','Awaiting Decision',59],[4,'Applied','Rejected',90],[5,'HR Interview','Awaiting Decision',90],[6,'Applied','Awaiting Decision',null]]) {
   await db.query('UPDATE recruiter_tracker SET hiring_stage=?, position_status=?, stage_entered_at=UTC_TIMESTAMP()-INTERVAL ? DAY WHERE id=?',[stage,status,days,id]);
  }
  const [first]=await ageAwaitingContacts(db);expect(first.affectedRows).toBe(2);
  const [second]=await ageAwaitingContacts(db);expect(second.affectedRows).toBe(0);
  const [rows]=await db.query('SELECT hiring_stage,position_status FROM recruiter_tracker ORDER BY id');
  expect(rows.map(row=>row.position_status)).toEqual(['Ghosted','Ghosted','Awaiting Decision','Rejected','Awaiting Decision','Awaiting Decision']);
  expect(rows.map(row=>row.hiring_stage)).toEqual(['Applied','Submitted','Applied','Applied','HR Interview','Applied']);
 });
 it('does not reclassify existing values or explicit clears on rerun',async()=>{
  await apply();
  await db.query("UPDATE recruiter_tracker SET role_category='Consultant',hiring_stage=NULL,position_status='Hired' WHERE id=2");
  const result=await apply();expect(result.addedColumns).toEqual([]);
  expect(result.updated).toEqual({role_category:0,hiring_stage:0,position_status:0});
  const [[row]]=await db.query('SELECT role_category,hiring_stage,position_status FROM recruiter_tracker WHERE id=2');
  expect(row).toEqual({role_category:'Consultant',hiring_stage:null,position_status:'Hired'});
 });
 it('refuses a wrong database or missing confirmation before changing schema',async()=>{
  await expect(migrateContactWorkflow(db,{expectedDatabase:database,confirmation:''})).rejects.toThrow('confirmation');
  await expect(migrateContactWorkflow(db,{expectedDatabase:'wrong',confirmation:'add-contact-workflow:wrong'})).rejects.toThrow('mismatch');
  const [columns]=await db.query('SHOW COLUMNS FROM recruiter_tracker');expect(columns).toHaveLength(4);
 });
 it('refuses incompatible existing column definitions before adding other columns',async()=>{
  await db.query('ALTER TABLE recruiter_tracker ADD COLUMN role_category INT NULL');
  await expect(apply()).rejects.toThrow('Incompatible');
  const [columns]=await db.query('SHOW COLUMNS FROM recruiter_tracker');expect(columns).toHaveLength(5);
 });
 it('rolls back partial backfill while retaining inspectable additive columns',async()=>{
  const failing={
   query:(sql,args)=>String(sql).startsWith('UPDATE recruiter_tracker SET hiring_stage')?Promise.reject(Error('fixture backfill failure')):db.query(sql,args),
   beginTransaction:()=>db.beginTransaction(),commit:()=>db.commit(),rollback:()=>db.rollback()
  };
  await expect(migrateContactWorkflow(failing,{expectedDatabase:database,confirmation:'add-contact-workflow:'+database})).rejects.toThrow('fixture backfill failure');
  const [rows]=await db.query('SELECT role_category,hiring_stage,position_status FROM recruiter_tracker');
  expect(rows.every(row=>Object.values(row).every(value=>value===null))).toBe(true);
 });
});
