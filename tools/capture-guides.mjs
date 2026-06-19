// =============================================================================
// Genetic Lab SPA — guide screenshot generator (Phase 2)
//
// Produces deterministic, per-step screenshots for the illustrated Help & FAQ
// guides, straight from the REAL running app loaded over bare file:// (no flags
// needed — see tools/probe-file-access.mjs).
//
// Output:  assets/guides/<guide-id>/step-NN.png        (light theme)
//          assets/guides/<guide-id>/step-NN-dark.png   (dark theme)
//
// Run:     node tools/capture-guides.mjs            # all guides, both themes
//          node tools/capture-guides.mjs log-test   # one guide, both themes
//
// Paths are resolved relative to this script, so nothing is machine-specific.
// =============================================================================
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const INDEX_URL = pathToFileURL(path.join(REPO, 'index.html')).href;
const ASSETS = path.join(REPO, 'assets', 'guides');

const VIEWPORT = { width: 1440, height: 900 };
const DSF = 2;
const ACTOR = 'Dr. Karimova';

const onlyArg = process.argv[2] || null;

// ---------- low-level helpers ----------------------------------------------

async function freshPage(context, theme) {
  // Deterministic boot: wipe storage, preset theme + operator name, reload so
  // the app re-seeds its demo data and applies our theme.
  const page = await context.newPage();
  await page.goto(INDEX_URL + '#/dashboard', { waitUntil: 'load' });
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('glab_v1_meta', JSON.stringify({ theme: t, actor: 'Dr. Karimova' }));
  }, theme);
  await page.goto(INDEX_URL + '#/dashboard', { waitUntil: 'load' });
  await page.waitForSelector('.gl-h1', { timeout: 8000 });
  await page.waitForTimeout(450); // fonts + first render settle
  return page;
}

async function nav(page, label) {
  await page.locator(`button[aria-label="${label}"]`).first().click();
  await page.waitForTimeout(350);
}

// Inject an accent ring around an element's box (and optional dimmed backdrop).
// Returns nothing; call clearHighlight() before the next action/screenshot.
async function highlight(page, locator, { dim = false, label = '' } = {}) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(({ b, dim, label }) => {
    const root = document.createElement('div');
    root.id = '__glab_hl';
    root.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none';
    if (dim) {
      const veil = document.createElement('div');
      veil.style.cssText = 'position:absolute;inset:0;background:rgba(6,12,18,.38)';
      // punch-through highlight handled by ring; veil sits under ring
      root.appendChild(veil);
    }
    const pad = 6;
    const ring = document.createElement('div');
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#0369a1';
    ring.style.cssText =
      `position:absolute;left:${b.x - pad}px;top:${b.y - pad}px;width:${b.width + pad * 2}px;height:${b.height + pad * 2}px;` +
      `border:3px solid ${accent};border-radius:12px;box-shadow:0 0 0 9999px rgba(6,12,18,${dim ? .42 : 0}), 0 0 0 4px ${accent}55, 0 6px 22px rgba(3,105,161,.35);`;
    root.appendChild(ring);
    if (label) {
      const tag = document.createElement('div');
      tag.textContent = label;
      // place the badge above the ring, but flip below when there is no headroom
      const above = b.y - pad - 34;
      const top = above < 6 ? (b.y + b.height + pad + 8) : above;
      tag.style.cssText =
        `position:absolute;left:${b.x - pad}px;top:${top}px;` +
        `background:${accent};color:#fff;font:600 13px/1 'IBM Plex Sans',sans-serif;padding:7px 11px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.3)`;
      root.appendChild(tag);
    }
    document.body.appendChild(root);
  }, { b: box, dim, label });
}

async function clearHighlight(page) {
  await page.evaluate(() => document.getElementById('__glab_hl')?.remove());
}

async function scrollTo(page, locator, block = 'center') {
  await locator.evaluate((el, block) => el.scrollIntoView({ block, behavior: 'instant' }), block);
  await page.waitForTimeout(200);
}

function shooter(guideId, suffix) {
  let n = 0;
  return async (page) => {
    n++;
    const dir = path.join(ASSETS, guideId);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `step-${String(n).padStart(2, '0')}${suffix}.png`);
    await page.screenshot({ path: file });
    await clearHighlight(page);
    process.stdout.write(`    ✓ ${path.relative(REPO, file)}\n`);
  };
}

// ---------- guide scenarios -------------------------------------------------
// Each receives (page, shoot, theme). `theme` only matters where the flow
// itself differs by theme (switch-theme starts from the current theme).

const GUIDES = {
  // 1 — Log a new test request -----------------------------------------------
  'log-test': async (page, shoot) => {
    const form = page.locator('#gl-log-form');
    await scrollTo(page, form, 'start');
    await highlight(page, form.locator('input[aria-label="Patient code"]'), { label: 'A patient code is suggested' });
    await shoot(page); // overview, patient code suggested

    const testSel = page.locator('select[aria-label="Test"]');
    await testSel.selectOption({ label: 'BRCA1/2 NGS Panel' });
    await scrollTo(page, testSel, 'center');
    await highlight(page, testSel, { label: 'Pick the test' });
    await shoot(page);

    const deptSel = page.locator('select[aria-label="Department"]');
    await deptSel.selectOption({ label: 'Oncology' });
    await highlight(page, deptSel, { label: 'Pick the department' });
    await shoot(page);

    const age = page.getByRole('button', { name: '40-49', exact: true });
    await age.click();
    await page.getByRole('button', { name: 'F', exact: true }).click();
    await scrollTo(page, age, 'center');
    await highlight(page, age, { label: 'Tap age group & sex' });
    await shoot(page);

    const status = page.getByRole('button', { name: 'In Progress', exact: true }).first();
    await status.click();
    await scrollTo(page, status, 'center');
    const submit = page.getByRole('button', { name: /Log test/ });
    await highlight(page, submit, { label: 'Press to save' });
    await shoot(page);
  },

  // 2 — Order a test from the catalog ----------------------------------------
  'order-from-catalog': async (page, shoot) => {
    await nav(page, 'Tests Catalog');
    const card = page.locator('.glab-card', { hasText: 'BRCA1/2 NGS Panel' }).first();
    const order = card.getByRole('button', { name: /Order/ });
    await scrollTo(page, card, 'center');
    await highlight(page, order, { label: 'Order this test', dim: true });
    await shoot(page); // catalog, Order button highlighted

    await order.click();
    await page.waitForTimeout(500);
    const form = page.locator('#gl-log-form');
    await scrollTo(page, form, 'start');
    await highlight(page, form.locator('select[aria-label="Test"]'), { label: 'Test & department pre-filled' });
    await shoot(page); // dashboard, prefilled

    await page.getByRole('button', { name: '40-49', exact: true }).click();
    await page.getByRole('button', { name: 'F', exact: true }).click();
    const submit = page.getByRole('button', { name: /Log test/ });
    await scrollTo(page, submit, 'center');
    await highlight(page, submit, { label: 'Finish & save' });
    await shoot(page);
  },

  // 3 — Fix / edit a logged record -------------------------------------------
  'fix-record': async (page, shoot) => {
    await nav(page, 'Records');
    const row = page.locator('table tbody tr').first();
    await scrollTo(page, row, 'center');
    await highlight(page, row, { label: 'Click the record to edit', dim: true });
    await shoot(page); // records list

    await row.click();
    await page.waitForTimeout(500);
    const form = page.locator('#gl-log-form');
    await scrollTo(page, form, 'start');
    await highlight(page, form.locator('h2').first(), { label: 'Opens as “Edit log”' });
    await shoot(page); // edit form

    const status = page.getByRole('button', { name: 'In Progress', exact: true }).first();
    await scrollTo(page, status, 'center');
    await status.click();
    await highlight(page, status, { label: 'Change what you need' });
    await shoot(page);

    const submit = page.getByRole('button', { name: /Update log/ });
    await scrollTo(page, submit, 'center');
    await highlight(page, submit, { label: 'Save the correction' });
    await shoot(page);
  },

  // 4 — Find the right test for a patient ------------------------------------
  'find-test': async (page, shoot) => {
    await nav(page, 'Tests Catalog');
    const search = page.locator('input[placeholder^="Search by name"]');
    await search.click();
    await search.fill('breast cancer');
    await page.waitForTimeout(400);
    await scrollTo(page, search, 'start');
    await highlight(page, search, { label: 'Search a clinical scenario' });
    await shoot(page);

    const inStock = page.getByRole('button', { name: /In stock only/ });
    await inStock.click();
    await page.waitForTimeout(300);
    await highlight(page, inStock, { label: 'Narrow to available kits' });
    await shoot(page);

    const card = page.locator('.glab-card', { hasText: 'BRCA1/2 NGS Panel' }).first();
    const details = card.getByText('Details →');
    await scrollTo(page, card, 'center');
    await details.click();
    await page.waitForTimeout(500);
    const modal = page.locator('[data-overlay]').first();
    await highlight(page, modal, { label: 'Read the indications' });
    await shoot(page); // detail modal with criteria

    // close modal, then point at Order on the card
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const order = card.getByRole('button', { name: /Order/ });
    await scrollTo(page, card, 'center');
    await highlight(page, order, { label: 'Order it for a patient', dim: true });
    await shoot(page);
  },

  // 5 — Adjust kit stock by hand ---------------------------------------------
  'adjust-stock': async (page, shoot) => {
    await nav(page, 'Kit Inventory');
    const row = page.locator('table tbody tr', { hasText: 'EGFR/KRAS PCR Kit' }).first();
    await scrollTo(page, row, 'center');
    await highlight(page, row, { label: 'Find the kit' });
    await shoot(page);

    const plus = row.getByRole('button', { name: 'Increase stock' });
    await highlight(page, plus, { label: 'Use − / + to adjust', dim: true });
    await shoot(page);

    await plus.click();
    await plus.click();
    await page.waitForTimeout(300);
    const stockCell = row.locator('td').nth(3);
    await highlight(page, stockCell, { label: 'Stock updates live' });
    await shoot(page);
  },

  // 6 — Switch light / dark theme --------------------------------------------
  'switch-theme': async (page, shoot, theme) => {
    const toggle = page.locator('button[aria-label="Toggle dark mode"]');
    const startLabel = theme === 'dark' ? 'Tap to go light' : 'Tap to go dark';
    await highlight(page, toggle, { label: startLabel });
    await shoot(page); // before

    await toggle.click();
    await page.waitForTimeout(450);
    await highlight(page, toggle, { label: 'Theme switches instantly' });
    await shoot(page); // after (opposite theme)
  },
};

// ---------- driver ----------------------------------------------------------

async function run() {
  const ids = onlyArg ? [onlyArg] : Object.keys(GUIDES);
  for (const id of ids) {
    if (!GUIDES[id]) { console.error(`Unknown guide: ${id}`); continue; }
    if (onlyArg) await rm(path.join(ASSETS, id), { recursive: true, force: true });
  }

  const browser = await chromium.launch({ args: [] }); // bare file://, no flags
  for (const theme of ['light', 'dark']) {
    const suffix = theme === 'dark' ? '-dark' : '';
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DSF });
    for (const id of ids) {
      if (!GUIDES[id]) continue;
      console.log(`\n▶ ${id} [${theme}]`);
      const page = await freshPage(context, theme);
      try {
        await GUIDES[id](page, shooter(id, suffix), theme);
      } catch (e) {
        console.error(`  ✗ ${id} [${theme}] failed:`, e.message);
      }
      await page.close();
    }
    await context.close();
  }
  await browser.close();
  console.log('\nDone.');
}

run();
