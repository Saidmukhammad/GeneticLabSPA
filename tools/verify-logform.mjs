// Phase 4 — functional check of the refactored Log form.
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const URL = pathToFileURL(path.join(REPO, 'index.html')).href;
const OUT = path.join(REPO, 'report-logform');
const res = []; const check=(n,c,x='')=>{res.push({n,c:!!c});console.log(`${c?'✓':'✗'} ${n}${x?'  ('+x+')':''}`);};

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text());}); page.on('pageerror',e=>errors.push(String(e)));
await mkdir(OUT,{recursive:true});

await page.goto(URL+'#/dashboard',{waitUntil:'load'});
await page.evaluate(()=>{localStorage.clear();localStorage.setItem('glab_v1_meta',JSON.stringify({theme:'light',actor:'Dr. K'}));});
await page.goto(URL+'#/dashboard',{waitUntil:'load'});
await page.waitForSelector('#gl-log-form'); await page.waitForTimeout(400);
const form = page.locator('#gl-log-form');

// Age is now a SELECT identical to Test/Department
const ageSel = form.locator('select[aria-label="Age group"]');
check('Age group is a <select>', await ageSel.count()===1);
const sameClass = await ageSel.evaluate(el=>el.classList.contains('gl-select'));
check('Age select reuses .gl-select component', sameClass);
const ageOpts = await ageSel.locator('option').allInnerTexts();
check('Age keeps all options', ['<18','18-29','30-39','40-49','50-59','60-69','70+'].every(a=>ageOpts.includes(a)), ageOpts.join(','));

// Age controls same height as Test select (unified)
const hAge = (await ageSel.boundingBox()).height;
const hTest = (await form.locator('select[aria-label="Test"]').boundingBox()).height;
check('Age select height == Test select height', Math.abs(hAge-hTest)<1, `${hAge} vs ${hTest}`);

// Required validation: submit empty-ish -> ageGroup error surfaces
await page.locator('select[aria-label="Test"]').selectOption({label:'BRCA1/2 NGS Panel'});
await page.locator('select[aria-label="Department"]').selectOption({label:'Oncology'});
await page.getByRole('button',{name:'F',exact:true}).click();
await form.getByRole('button',{name:/Log test/}).click();
await page.waitForTimeout(300);
const ageErr = await ageSel.evaluate(el=>el.classList.contains('gl-err'));
check('Empty Age blocks submit (gl-err shown)', ageErr);

// pick age -> error clears, can submit
await ageSel.selectOption({label:'40-49'});
await page.waitForTimeout(200);
check('Selecting Age clears its error', !(await ageSel.evaluate(el=>el.classList.contains('gl-err'))));

// Sex + Status still segmented buttons
check('Sex is segmented buttons', await form.locator('.gl-choice button',{hasText:'Undisclosed'}).count()===1);
const statusBtns = await form.getByRole('button',{name:/Received|In Progress|Reported|Cancelled/}).count();
check('Status is 4 segmented buttons', statusBtns===4);

// Status + Date received share one row (date right of status, not full width)
const statusBox = await form.locator('.gl-choice', {hasText:'Received'}).boundingBox();
const dateBox = await form.locator('input[aria-label="Date received"]').boundingBox();
check('Date received sits to the RIGHT of Status (same row)', dateBox.x > statusBox.x + 200 && Math.abs(dateBox.y-statusBox.y)<120, `dateX=${Math.round(dateBox.x)} statusX=${Math.round(statusBox.x)}`);
check('Date received is NOT full width', dateBox.width < (await form.boundingBox()).width*0.6, `w=${Math.round(dateBox.width)}`);

// Reported reveals Date reported in the right column under Date received
await form.getByRole('button',{name:'Reported',exact:true}).click();
await page.waitForTimeout(300);
const dr = form.locator('input[aria-label="Date reported"]');
check('Selecting Reported reveals Date reported', await dr.count()===1);
const drBox = await dr.boundingBox();
check('Date reported stacks under Date received (right column)', drBox.y > dateBox.y+20 && Math.abs(drBox.x-dateBox.x)<5);

// status colour dots intact
const dotColors = await form.locator('.gl-choice button span[style*="border-radius:50%"]').evaluateAll(els=>els.map(e=>e.style.background).filter(Boolean));
check('Status colour dots present', dotColors.length>=4, dotColors.length+' dots');

// buttons unified (no lg) - height == control height 48
const btnH = (await form.getByRole('button',{name:/Log test/}).boundingBox()).height;
check('Submit button height == 48 (unified, not lg/56)', Math.abs(btnH-48)<2, btnH+'px');

// anonymized note + prefilled patient code preserved
check('Anonymized note preserved', await form.getByText('Anonymized only — no names or birth dates').count()===1);
check('Patient code prefilled', /LAB-\d{4}-\d{4}/.test(await form.locator('input[aria-label="Patient code"]').inputValue()));

// dark theme renders without error
await page.locator('button[aria-label="Toggle dark mode"]').click();
await page.waitForTimeout(300);
await form.screenshot({path:path.join(OUT,'after-dark-reported.png')});
check('No console/page errors', errors.length===0, errors.slice(0,3).join(' | '));

console.log('\n==== SUMMARY ====');
const fail=res.filter(r=>!r.c);
console.log(`${res.length-fail.length}/${res.length} passed`);
if(fail.length){console.log('FAILED:',fail.map(f=>f.n).join(', '));process.exitCode=1;}
await browser.close();
