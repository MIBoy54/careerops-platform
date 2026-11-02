
import {test,expect} from '@playwright/test';

const contacts=[
  {id:1,date_contacted:'2026-10-01',company:'Acme Agency',role_level:'Senior Test Architect',recruiter_name:'Fixture Recruiter',status:'Applied',location:'Older location'},
  {id:2,date_contacted:'2026-11-02',company:'Acme Agency',role_level:'Quality Engineering Manager',recruiter_name:'Fixture Recruiter',status:'Applied',location:'Newer location'},
  {id:3,date_contacted:'2026-11-01',company:'<img src=x onerror="globalThis.searchInjected=true">',role_level:'Security reviewer',recruiter_name:'Fixture Recruiter',status:'Applied'}
];
async function open(page,role='guest'){
  await page.route('**/version',route=>route.fulfill({json:{environment:role==='guest'?'demo':'test',demoEntrySnapshots:role==='guest'}}));
  await page.route('**/api/auth/me',route=>route.fulfill({json:{app_env:role==='guest'?'demo':'test',user:{id:0,role}}}));
  await page.route('**/api/contacts',route=>route.fulfill({json:contacts}));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-careerops-ready','true');
  await page.locator('[data-target="contactFormSection"]').click();
}
for(const width of [1280,390]){
  test.describe('Company lookup at '+width+'px',()=>{
    test.use({viewport:{width,height:900},hasTouch:width===390});
    test('guest searches at two characters and selects the exact contact without writing',async({page})=>{
      let writes=0;
      page.on('request',request=>{if(/\/api\/contacts(?:\/|$)/.test(new URL(request.url()).pathname)&&!['GET','HEAD'].includes(request.method()))writes++;});
      await open(page);
      const input=page.locator('#company');
      await expect(input).toBeEnabled();
      await expect(page.locator('#role_level')).toHaveAttribute('type','text');
      await expect(page.locator('label[for="role_level"]')).toHaveText('Role');
      await input.fill('a');
      await expect(page.locator('#companySuggestions')).toBeHidden();
      await input.fill(' aC ');
      await expect(page.locator('#companySuggestions [role="option"]')).toHaveCount(2);
      await expect(page.locator('#companySuggestions')).toContainText('2026-10-01');
      await expect(page.locator('#companySuggestions')).toContainText('Senior Test Architect');
      const older=page.locator('[data-contact-id="1"]');
      if(width===390)await older.tap();else await older.click();
      await expect(page.locator('#date_contacted')).toHaveValue('2026-10-01');
      await expect(page.locator('#location')).toHaveValue('Older location');
      await expect(page.locator('#role_level')).toHaveValue('Senior Test Architect');
      await expect(page.locator('#role_level')).toBeDisabled();
      await expect(page.locator('#recruiter_name')).toBeDisabled();
      await expect(page.locator('#contactForm button[type="submit"]')).toBeDisabled();
      await expect(input).toBeEnabled();
      await expect(page.locator('#formMessage')).toContainText('viewing');
      await input.press('Enter');
      expect(writes).toBe(0);
      await page.locator('#resetButton').click();
      await expect(input).toHaveValue('');
      await input.fill('not-present');
      await expect(page.locator('#companySearchStatus')).toHaveText('No matching contacts.');
      await expect(page.locator('#companySuggestions')).toBeHidden();
      await input.fill('ac');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    });
  });
}
test('keyboard selection chooses the requested row and Escape dismisses results',async({page})=>{
  await open(page);
  const input=page.locator('#company');
  await input.fill('ac');
  await input.press('ArrowDown');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page.locator('#location')).toHaveValue('Older location');
  await input.fill('ac');
  await input.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#companySuggestions')).toBeHidden();
});
test('admin edits the selected record by ID and preserves a free-text Role',async({page})=>{
  let saved;
  await page.route('**/api/contacts/1',async route=>{
    saved={method:route.request().method(),data:route.request().postDataJSON()};
    await route.fulfill({json:{success:true}});
  });
  await open(page,'admin');
  await page.locator('#company').fill('ac');
  await page.locator('[data-contact-id="1"]').click();
  await expect(page.locator('#role_level')).toBeEnabled();
  await page.locator('#role_level').fill('Principal Quality Architect');
  await page.locator('#contactForm button[type="submit"]').click();
  await expect.poll(()=>saved?.method).toBe('PUT');
  expect(saved.data.role_level).toBe('Principal Quality Architect');
});
test('search displays company markup as text',async({page})=>{
  await open(page);
  await page.locator('#company').fill('<i');
  await expect(page.locator('#companySuggestions [role="option"]')).toHaveCount(1);
  await expect(page.locator('#companySuggestions')).toContainText('<img');
  await expect(page.locator('#companySuggestions img')).toHaveCount(0);
  expect(await page.evaluate(()=>globalThis.searchInjected)).toBeUndefined();
});

test('all matching contacts remain selectable when one company has more than ten records',async({page})=>{
  await open(page);
  const many=Array.from({length:13},(_,index)=>({...contacts[0],id:100+index,role_level:'Role '+index}));
  await page.route('**/api/contacts',route=>route.fulfill({json:many}));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-careerops-ready','true');
  await page.locator('[data-target="contactFormSection"]').click();
  await page.locator('#company').fill('ac');
  await expect(page.locator('#companySuggestions [role="option"]')).toHaveCount(13);
  await page.locator('[data-contact-id="100"]').click();
  await expect(page.locator('#role_level')).toHaveValue('Role 0');
});
