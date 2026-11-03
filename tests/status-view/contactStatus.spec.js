import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const records=[
 {id:1,company:'Thrivent',date_contacted:'2026-11-03',hiring_stage:'Applied',position_status:'Awaiting Decision',reported_unemployment:'No'},
 {id:2,company:'HCA',date_contacted:'2026-11-03',hiring_stage:'Submitted',position_status:'Awaiting Decision',reported_unemployment:'Yes'},
 {id:3,company:'Thrivent',date_contacted:'2026-11-03',hiring_stage:'HR Interview',position_status:'Hired',reported_unemployment:'No'},
 {id:4,company:'Legacy',date_contacted:'2026-11-02',status:'Offer',reported_unemployment:'No'}
];
test('totals, filters, badges, keyboard sorting and selections agree',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://careerops.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/me')return route.fulfill({json:{app_env:'demo',user:{role:'guest'}}});
  if(path==='/api/contacts')return route.fulfill({json:records});
  if(path==='/api/reports')return route.fulfill({json:[]});
  if(path.startsWith('/api/'))return route.fulfill({status:500,json:{error:'Optional service unavailable in fixture'}});
  const file=path==='/'?'ui/index.html':path.slice(1);
  try {return route.fulfill({body:await readFile(resolve(file)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});}
  catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('http://careerops.test/');
 await expect(page.locator('html')).toHaveAttribute('data-careerops-ready','true');
 await page.getByTestId('saved-contacts-nav').click();
 await expect(page.locator('#contactVisibleCount')).toHaveText('Showing 4 of 4 records');
 await expect(page.locator('#contactsTable tbody tr')).toHaveCount(4);
 expect(await page.locator('#contactTotals').innerHTML()).toBe(await page.locator('#dashboardContactTotals').innerHTML());
 await expect(page.locator('#contactTotals')).toContainText('All records: 4');
 await expect(page.locator('#contactsTable .tone-amber')).toHaveCount(2);
 await expect(page.locator('#contactsTable .tone-green')).toHaveCount(2);
 await expect(page.locator('#contactsTable')).toContainText('Previous status: Offer');
 await expect(page.locator('[data-id="2"].select-checkbox')).toBeDisabled();
 await page.locator('[data-id="1"].select-checkbox').check();
 await page.locator('[data-sort="company"]').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#sortCompanyHeader')).toHaveAttribute('aria-sort','ascending');
 await expect(page.locator('#sortDateHeader')).toHaveAttribute('aria-sort','none');
 await expect(page.locator('[data-id="1"].select-checkbox')).toBeChecked();
 expect(await page.locator('#contactsTable tbody tr').first().locator('td').nth(2).textContent()).toBe('HCA');
 await page.locator('[data-sort="company"]').click();
 await expect(page.locator('#sortCompanyHeader')).toHaveAttribute('aria-sort','descending');
 await page.locator('#positionFilter').selectOption('Awaiting Decision');
 await expect(page.locator('#contactVisibleCount')).toHaveText('Showing 2 of 4 records');
 await page.locator('#reportingFilter').selectOption('Not Reported');
 await expect(page.locator('#contactVisibleCount')).toHaveText('Showing 1 of 4 records');
 await page.locator('#stageFilter').selectOption('HR Interview');
 await expect(page.locator('#contactVisibleCount')).toHaveText('Showing 0 of 4 records');
 await expect(page.locator('#contactTotals')).toContainText('All records: 4');
 for(const id of ['stageFilter','positionFilter','reportingFilter'])await page.locator('#'+id).selectOption('all');
 await expect(page.locator('[data-id="1"].select-checkbox')).toBeChecked();
 await page.screenshot({path:testInfo.outputPath('contact-status-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:testInfo.outputPath('contact-status-mobile.png'),fullPage:true});
 expect(errors).toEqual([]);
});
