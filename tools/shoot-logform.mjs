// Screenshot the dashboard "Log a test request" block in both themes.
// Run: node tools/shoot-logform.mjs <label>      e.g. before | after
// Output: report-logform/<label>-<theme>.png
import { chromium } from 'playwright';
import { pathToFileURL, fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const URL = pathToFileURL(path.join(REPO, 'index.html')).href;
const OUT = path.join(REPO, 'report-logform');
const label = process.argv[2] || 'shot';

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await mkdir(OUT, { recursive: true });

for (const theme of ['light', 'dark']) {
  await page.goto(URL + '#/dashboard', { waitUntil: 'load' });
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('glab_v1_meta', JSON.stringify({ theme: t, actor: 'Dr. Karimova' }));
  }, theme);
  await page.goto(URL + '#/dashboard', { waitUntil: 'load' });
  await page.waitForSelector('#gl-log-form');
  await page.waitForTimeout(500);
  const form = page.locator('#gl-log-form');
  await form.scrollIntoViewIfNeeded();
  const file = path.join(OUT, `${label}-${theme}.png`);
  await form.screenshot({ path: file });
  console.log('✓', path.relative(REPO, file));
}
await browser.close();
