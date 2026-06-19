// Phase 4 — verify the rebuilt Help & FAQ over bare file://.
// Run: node tools/verify-faq.mjs
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const URL = pathToFileURL(path.join(REPO, 'index.html')).href;
const OUT = path.join(REPO, 'report');
const results = [];
function check(name, cond, extra='') { results.push({ name, ok: !!cond, extra }); console.log(`${cond?'✓':'✗'} ${name}${extra?'  ('+extra+')':''}`); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await mkdir(OUT, { recursive: true });

await page.goto(URL + '#/faq', { waitUntil: 'load' });
await page.waitForSelector('.gl-h1');
await page.waitForTimeout(500);

// 1. grid renders with cards
const cardCount = await page.locator('button.glab-card').count();
check('FAQ grid renders cards', cardCount >= 10, cardCount + ' cards');
await page.screenshot({ path: path.join(OUT, 'verify-faq-grid-light.png') });

// 2. open a GUIDE card → modal with images
await page.locator('button.glab-card', { hasText: 'Log a new test request' }).click();
await page.waitForTimeout(450);
const dlg = page.locator('[role="dialog"]');
check('Guide modal opens (role=dialog)', await dlg.count() === 1);
const imgs = dlg.locator('img');
const imgCount = await imgs.count();
const loaded = await imgs.evaluateAll(els => els.every(i => i.complete && i.naturalWidth > 0));
check('Guide step screenshots load', imgCount >= 5 && loaded, imgCount + ' imgs, loaded=' + loaded);
// focus moved into dialog
const focusInDialog = await page.evaluate(() => { const d=document.querySelector('[role="dialog"]'); return d && d.contains(document.activeElement); });
check('Focus moves into modal', focusInDialog);
await page.screenshot({ path: path.join(OUT, 'verify-faq-guide-light.png') });

// 3. Esc closes + focus returns
await page.keyboard.press('Escape');
await page.waitForTimeout(350);
check('Esc closes modal', await page.locator('[role="dialog"]').count() === 0);
const focusReturned = await page.evaluate(() => document.activeElement && document.activeElement.textContent.includes('Log a new test request'));
check('Focus returns to originating card', focusReturned);

// 4. backdrop click closes
await page.locator('button.glab-card', { hasText: 'Fix a logged record' }).click();
await page.waitForTimeout(350);
await page.mouse.click(20, 20); // backdrop area
await page.waitForTimeout(300);
check('Backdrop click closes modal', await page.locator('[role="dialog"]').count() === 0);

// 5. close button closes
await page.locator('button.glab-card', { hasText: 'Adjust kit stock' }).click();
await page.waitForTimeout(350);
await page.locator('button[aria-label="Close guide"]').click();
await page.waitForTimeout(300);
check('Close button closes modal', await page.locator('[role="dialog"]').count() === 0);

// 6. NOTE card → text-only modal (no images)
await page.locator('button.glab-card', { hasText: 'What is the patient code' }).click();
await page.waitForTimeout(350);
const noteImgs = await page.locator('[role="dialog"] img').count();
check('Note card opens text-only modal', noteImgs === 0);
await page.keyboard.press('Escape');
await page.waitForTimeout(250);

// 7. hash + scroll intact
check('Hash route still #/faq', (await page.evaluate(() => location.hash)) === '#/faq', await page.evaluate(()=>location.hash));

// 8. DARK theme
await page.locator('button[aria-label="Toggle dark mode"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'verify-faq-grid-dark.png') });
await page.locator('button.glab-card', { hasText: 'Find the right test' }).click();
await page.waitForTimeout(450);
const darkLoaded = await page.locator('[role="dialog"] img').evaluateAll(els => els.length>0 && els.every(i => i.complete && i.naturalWidth>0));
const darkSrc = await page.locator('[role="dialog"] img').first().getAttribute('src');
check('Dark-theme guide loads -dark screenshots', darkLoaded && /-dark\.png$/.test(darkSrc), darkSrc);
await page.screenshot({ path: path.join(OUT, 'verify-faq-guide-dark.png') });
await page.keyboard.press('Escape');

check('No console/page errors', errors.length === 0, errors.slice(0,3).join(' | '));

console.log('\n==== SUMMARY ====');
const failed = results.filter(r => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.log('FAILED:', failed.map(f=>f.name).join(', ')); process.exitCode = 1; }
await browser.close();
