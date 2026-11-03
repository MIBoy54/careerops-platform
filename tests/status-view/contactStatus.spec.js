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
  // An existing browser may retain this previous stylesheet for four hours.
  if(path==='/src/App.css' && !new URL(route.request().url()).search)return route.fulfill({contentType:'text/css',body:'button { background: green; }'});
  const file=path==='/'?'ui/index.html':path.slice(1);
  try {return route.fulfill({body:await readFile(resolve(file)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});}
  catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('http://careerops.test/');
 await expect(page.locator('html')).toHaveAttribute('data-careerops-ready','true');
 await page.getByTestId('saved-contacts-nav').click();
 await expect(page.locator('#contactVisibleCount')).toHaveText('Showing 4 of 4 records');
 await expect(page.locator('#contactsTable tbody tr')).toHaveCount(4);
 await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href','/src/App.css?v=13');
 expect(await page.locator('#contactTotals .contact-totals-grid').evaluate(el=>getComputedStyle(el).display)).toBe('grid');
 expect(await page.locator('#contactsTable .tone-amber').first().evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(254, 243, 199)');
 expect(await page.locator('[data-sort="company"]').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
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
 // Click header-cell padding as well as the keyboard-operable button.
 const ids = () => page.locator('#contactsTable tbody .select-checkbox').evaluateAll(inputs => inputs.map(input => Number(input.dataset.id)));
 for (const [field, expected] of [
  ['company', [2,4,1,3]], ['stage', [1,2,3,4]], ['position', [2,1,3,4]]
 ]) {
  // Company is currently descending; new columns start ascending.
  const header = page.locator('#contactsTable th').filter({has:page.locator('[data-sort="'+field+'"]')});
  await header.click({position:{x:2,y:2}});
  await expect(header).toHaveAttribute('aria-sort','ascending');
  expect(await ids()).toEqual(expected);
  await page.locator('[data-sort="'+field+'"]').focus();await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-sort','descending');
  expect(await ids()).toEqual(field==='company' ? [1,3,4,2] : field==='stage' ? [4,3,2,1] : [4,3,2,1]);
 }
 await expect(page.locator('[data-id="1"].select-checkbox')).toBeChecked();
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
