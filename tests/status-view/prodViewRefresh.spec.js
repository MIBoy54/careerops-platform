import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
async function fixture(page,{environment='demo',enabled=true,fail=false,expiresIn=3600000}={}){
 let captures=0;
 const capturedAt=new Date().toISOString();
 await page.route('http://careerops.test/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/version')return route.fulfill({json:{environment,demoEntrySnapshots:enabled}});
  if(path==='/api/auth/me')return route.fulfill({json:{app_env:environment,user:{role:environment==='demo'?'guest':'admin'}}});
  if(path==='/api/demo-snapshot')return route.fulfill({json:{capturedAt,expiresAt:new Date(Date.parse(capturedAt)+expiresIn).toISOString()}});
  if(path==='/api/demo-snapshot/session'){captures++;return route.fulfill({status:fail?503:200,json:fail?{error:'Unavailable'}:{app_env:'demo',user:{role:'guest'},snapshot:{capturedAt:new Date().toISOString()}}});}
  if(path==='/api/contacts'||path==='/api/reports')return route.fulfill({json:[]});
  if(path.startsWith('/api/'))return route.fulfill({status:500,json:{error:'Optional fixture service'}});
  const file=path==='/'?'ui/index.html':path.slice(1);
  try{return route.fulfill({body:await readFile(resolve(file)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('http://careerops.test/');
 await expect(page.locator('html')).toHaveAttribute('data-careerops-ready','true');
 return ()=>captures;
}
test('expired snapshot requires explicit refresh and reports capture failure with retry',async({page},testInfo)=>{
 await page.clock.install();
 const captures=await fixture(page,{expiresIn:60000,fail:true});
 await expect(page.locator('#refreshProdView')).toBeVisible();
 await expect(page.locator('#prodViewCapturedAt')).not.toHaveText('Loading…');
 await page.clock.fastForward(61000);
 await expect(page.locator('#refreshProdView')).toHaveText('Load latest PROD view');
 await expect(page.locator('#prodViewMessage')).toContainText('expired');
 expect(captures()).toBe(0);
 await page.screenshot({path:testInfo.outputPath('prod-view-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('#refreshProdView')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('prod-view-mobile.png'),fullPage:true});
 await page.locator('#refreshProdView').click();
 await expect(page.locator('#prodViewMessage')).toContainText('has not refreshed');
 await expect(page.locator('#refreshProdView')).toBeEnabled();
 expect(captures()).toBe(1);
 await page.locator('#refreshProdView').click();
 await expect(page.locator('#refreshProdView')).toBeEnabled();
 expect(captures()).toBe(2);
});
for(const scenario of [{environment:'production',enabled:true},{environment:'demo',enabled:false}])test('refresh hidden for '+JSON.stringify(scenario),async({page})=>{
 const captures=await fixture(page,scenario);
 await expect(page.locator('#prodViewControls')).toBeHidden();
 expect(captures()).toBe(0);
});
