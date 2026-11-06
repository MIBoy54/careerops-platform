
import {test,expect} from '@playwright/test';
import {login} from '../helpers/auth.js';
async function find(page,id){
 await page.locator('[data-target="contactFormSection"]').click();
 await page.locator('#company').fill('WF');
 await page.locator('[data-contact-id="'+id+'"]').click();
}
test('owner creates independent workflow fields, edits stages and filters Hired accurately',async({page})=>{
 await page.route("**/api/auth/me", async route => {
  const response=await route.fetch();
  const data=await response.json();
  await route.fulfill({response,json:{...data,app_env:"production"}});
 });
 await login(page);let id;
 try{
  await page.locator('[data-target="contactFormSection"]').click();
  expect(await page.locator('#role_category option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean))).toEqual(['Consultant','Individual Contributor','Leadership']);
  expect(await page.locator('#hiring_stage option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean))).toEqual(['Applied','Recruiter Interview','Submitted','HR Interview','Hiring Interview','Offer Letter']);
  expect(await page.locator('#position_status option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean))).toEqual(['Accepted','Awaiting Decision','Closed','Ghosted','Hired','On-hold','Rejected']);
  const company='WF canonical '+Date.now();
  await page.locator('#recruiter_name').fill('Workflow fixture');
  await page.locator('#company').fill(company);
  await page.locator('#role_level').fill('Quality Lead');
  await page.locator('#role_category').selectOption('Individual Contributor');
  await expect(page.locator('#interview_date')).toBeHidden();
  await page.locator('#date_contacted').fill('2026-11-01');
  await page.locator('#hiring_stage').selectOption('Recruiter Interview');
  await expect(page.locator('#interview_date')).toBeVisible();
  await page.locator('#position_status').selectOption('Awaiting Decision');
  const created=page.waitForResponse(r=>r.url().endsWith('/api/contacts')&&r.request().method()==='POST');
  await page.locator('#contactForm button[type="submit"]').click();const response=await created;
  expect(response.status()).toBe(201);id=(await response.json()).id;
  await expect(page.locator('#company')).toHaveValue('');
  await find(page,id);
  await expect(page.locator('#hiring_stage')).toHaveValue('Recruiter Interview');
  await page.locator('#hiring_stage').selectOption('Submitted');await page.locator('#position_status').selectOption('On-hold');
  let saved=page.waitForResponse(r=>r.url().endsWith('/api/contacts/'+id)&&r.request().method()==='PUT');
  await page.locator('#contactForm button[type="submit"]').click();expect((await saved).status()).toBe(200);
  await expect(page.locator('#company')).toHaveValue('');await find(page,id);
  await expect(page.locator('#hiring_stage')).toHaveValue('Submitted');await expect(page.locator('#position_status')).toHaveValue('On-hold');
  await page.locator('#hiring_stage').selectOption('Hiring Interview');await page.locator('#position_status').selectOption('Hired');
  saved=page.waitForResponse(r=>r.url().endsWith('/api/contacts/'+id)&&r.request().method()==='PUT');
  await page.locator('#contactForm button[type="submit"]').click();expect((await saved).status()).toBe(200);
  await expect(page.locator('#company')).toHaveValue('');
  const record=(await(await page.request.get('/api/contacts')).json()).find(row=>row.id===id);
  expect(record).toMatchObject({hiring_stage:'Hiring Interview',position_status:'Hired',role_category:'Individual Contributor',status:'Interviewing',reported_unemployment:'No'});
  await page.locator('[data-target="savedContactsSection"]').click();await page.locator('#positionFilter').selectOption('Hired');
  await expect(page.locator('#contactsTable')).toContainText(company);
  await page.locator('#positionFilter').selectOption('Awaiting Decision');await expect(page.locator('#contactsTable')).not.toContainText(company);
  await page.locator('[data-target="dashboardSection"]').click();
  await expect(page.locator('#dashboardContactTotals')).toContainText('Hired');
  await page.locator('#dashboardContactTotals [data-interview-stage="Hiring Interview"]').click();
  const results=page.getByRole('dialog',{name:'Hiring Interview results'});
  await results.getByRole('combobox',{name:'Position status for '+company}).selectOption('Accepted');
  await expect(results.getByRole('status')).toHaveText('Position status saved.');
  const updated=(await(await page.request.get('/api/contacts')).json()).find(row=>row.id===id);
  expect(updated).toMatchObject({hiring_stage:'Hiring Interview',position_status:'Accepted',company,status:'Interviewing'});
  await results.getByRole('button',{name:'Edit Contact for '+company}).click();
  await expect(page.locator('#company')).toHaveValue(company);
  await expect(page.locator('#date_contacted')).toHaveValue('2026-11-01');
  await page.locator('#interview_date').fill('2026-11-05');
  await page.locator('#contactForm button[type="submit"]').click();
  await expect(results.getByRole('row').filter({hasText:company})).toContainText('2026-11-05');
 }finally{if(id)await page.request.delete('/api/contacts/'+id);}
});
test('editing ambiguous legacy data does not guess or discard its classifications',async({page})=>{
 await login(page);let id;
 try{
  const response=await page.request.post('/api/contacts',{data:{company:'WF legacy '+Date.now(),recruiter_name:'Legacy fixture',role_level:'Director',role_type:'QE Transformation',status:'Offer',reported_unemployment:'Yes'}});
  id=(await response.json()).id;
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-careerops-ready','true');
  await find(page,id);
  for(const field of ['role_category','hiring_stage','position_status'])await expect(page.locator('#'+field)).toHaveValue('');
  await expect(page.locator('#legacyWorkflowContext')).toContainText('QE Transformation');
  await expect(page.locator('#legacyWorkflowContext')).toContainText('Offer');
  await page.locator('#notes').fill('Edited fixture note');
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/contacts/'+id)&&r.request().method()==='PUT');
  await page.locator('#contactForm button[type="submit"]').click();expect((await saved).status()).toBe(200);
  const record=(await(await page.request.get('/api/contacts')).json()).find(row=>row.id===id);
  expect(record).toMatchObject({role_type:'QE Transformation',status:'Offer',role_category:null,hiring_stage:null,position_status:null,reported_unemployment:'Yes'});
 }finally{if(id)await page.request.delete('/api/contacts/'+id);}
});
test('guest can view canonical fields but cannot change or save them',async({page})=>{
 const contact={id:99,company:'WF protected fixture',recruiter_name:'Protected contact',role_level:'Lead',role_category:'Leadership',hiring_stage:'HR Interview',interview_date:'2026-11-05',position_status:'Rejected',role_type:'QE Transformation',status:'Interviewing'};
 await page.route('**/api/auth/me',route=>route.fulfill({json:{app_env:'demo',user:{role:'guest'}}}));
 await page.route('**/api/contacts',route=>route.fulfill({json:[contact]}));
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-careerops-ready','true');await expect(page.locator('#dashboardKpiInterviews')).toHaveText('1');
 await expect(page.locator('#dashboardKpiInterviewRate')).toHaveText('100.0%');
 await expect(page.locator('#dashboardOpenInterviews')).toHaveText('0');
 await page.locator('[data-target="dashboardSection"]').click();
 await page.locator('#dashboardContactTotals [data-interview-stage="HR Interview"]').click();
 const results=page.getByRole('dialog',{name:'HR Interview results'});
 await expect(results.locator('tbody td')).toHaveText(['2026-11-05','WF protected fixture','Rejected']);
 await expect(results.locator('select')).toHaveCount(0);
 await expect(results.getByRole('button',{name:/Edit Contact/})).toHaveCount(0);
 await results.getByRole('button',{name:'Close'}).click();
 await find(page,99);
 for(const [field,value] of [['role_category','Leadership'],['hiring_stage','HR Interview'],['position_status','Rejected']]){
  await expect(page.locator('#'+field)).toHaveValue(value);await expect(page.locator('#'+field)).toBeDisabled();
 }
 await expect(page.locator('#contactForm button[type="submit"]')).toBeDisabled();
});
