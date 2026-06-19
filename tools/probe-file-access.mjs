// Phase 1 probe: determine whether the SPA boots from a bare file:// URL,
// or whether Chromium needs --allow-file-access-from-files / --disable-web-security.
// Run: node tools/probe-file-access.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const indexUrl = pathToFileURL(path.join(repoRoot, 'index.html')).href + '#/faq';

async function trial(label, args) {
  const browser = await chromium.launch({ args });
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(indexUrl, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  // Did the app actually render? #app should have child content and an <h1>.
  const appChildren = await page.evaluate(() => document.getElementById('app')?.children.length || 0);
  const h1 = await page.evaluate(() => document.querySelector('.gl-h1')?.textContent || null);
  const fontsLoaded = await page.evaluate(() => Array.from(document.fonts).some(f => f.family.includes('Plex') && f.status === 'loaded'));
  const route = await page.evaluate(() => location.hash);
  console.log(`\n=== ${label} ===`);
  console.log('  args:', JSON.stringify(args));
  console.log('  #app children:', appChildren);
  console.log('  h1 text:', h1);
  console.log('  hash:', route);
  console.log('  Plex font loaded:', fontsLoaded);
  console.log('  console errors:', consoleErrors.length, consoleErrors.slice(0, 5));
  console.log('  page errors:', pageErrors.length, pageErrors.slice(0, 5));
  await browser.close();
  return { appChildren, h1, booted: appChildren > 0 && !!h1 };
}

const bare = await trial('BARE file:// (no flags)', []);
const flagged = await trial('WITH --allow-file-access-from-files', ['--allow-file-access-from-files']);
const nosec = await trial('WITH --disable-web-security', ['--allow-file-access-from-files', '--disable-web-security']);

console.log('\n================ SUMMARY ================');
console.log('bare booted   :', bare.booted);
console.log('flagged booted:', flagged.booted);
console.log('nosec booted  :', nosec.booted);
