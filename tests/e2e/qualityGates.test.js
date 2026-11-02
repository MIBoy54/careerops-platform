import {test,expect} from '@playwright/test';
test('latest quality gates label failures and refresh a pending environment',async({page})=>{
 let reads=0;
 await page.route('**/api/auth/me',route=>route.fulfill({json:{app_env:'test',user:{id:0,role:'admin'}}}));
 await page.route('**/api/contacts',route=>route.fulfill({json:[]}));
 await page.route('**/api/github/actions-summary',route=>{
  reads++;
  return route.fulfill({json:['DEV','QA','DEMO','PROD'].map((environment,index)=>({
   environment,branch:['develop','qa','demo','main'][index],status:environment==='QA'?(reads===1?'queued':'success'):environment==='PROD'?'failure':'success',
   workflow:'<img src=x onerror="globalThis.injected=true">',commit:'fixture',runNumber:1,completedAt:'2026-11-02T12:00:00Z',duration:'60s'
  }))});
 });
 await page.goto('/');
 await expect(page.locator('.quality-card')).toHaveCount(4);
 await expect(page.locator('h3').filter({hasText:'Latest Quality Gates'})).toBeVisible();
 const qa=page.locator('.quality-card').filter({hasText:'QA Quality Gate'});
 await expect(qa).toContainText('Queued');
 await expect(page.locator('.quality-card').filter({hasText:'PROD Quality Gate'})).toHaveClass(/quality-failed/);
 await expect(page.locator('#validationRunsTable img')).toHaveCount(0);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await expect(qa).toContainText('Passed');
});
