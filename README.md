# Genetic Laboratory Management SPA

A single-file, zero-build web app for a molecular-genetics laboratory
(Gustave Roussy Intl · Uzbekistan). Implemented from the Claude Design handoff
(`Genetic Lab.dc.html`) as production-ready vanilla HTML/CSS/JS.

## Run it

No build step, no dependencies to install. Either:

- **Open directly** — double-click `index.html`, or
- **Serve locally** (recommended, avoids `file://` quirks):
  ```bash
  python3 -m http.server 8000
  # then visit http://localhost:8000/index.html
  ```

The only external dependency is **Chart.js**, loaded from a CDN, so the
Analytics charts need an internet connection on first load.

## What it does

Five views routed by URL hash (`#/dashboard`, `#/catalog`, …), plus a Help/FAQ
page reachable from the floating **?** button (bottom-right, on every screen). The
navigation lives as the first section at the top of the page rather than a separate
top bar:

- **Dashboard** — the home/work screen: navigation, four KPI cards each with its own
  mini trend (a 6-month sparkline for *tests performed*, *avg turnaround* and *top
  test*; an OK/Low/Out composition bar for *kits*), overdue (TAT-breach) alerts, the
  **Log a test** form embedded as a section (the 3-step anonymized workflow with
  big age/sex/status button groups, auto-suggested patient code and progressive
  disclosure of the reported date), recent activity, and most-requested tests.
  Editing a log (from Recent activity or Records) opens it in this same form.
- **Test Catalog** — searchable/filterable card grid that also covers the old
  *Test Finder*: filter by protocol, department, clinical use, sample type and an
  *in stock only* toggle; each card has a full detail modal and an **Order →**
  action that pre-fills the dashboard log form. Departments are managed from
  **Admin → ⚙ → Departments** (no separate page).
- **Kit Inventory** — stock table with low/out/expiring flags and quick +/- adjust.
  New kits can also be created inline while linking one on the test form.
- **Records** — searchable registry of every logged request, filterable by free text
  (patient code / test / doctor / department), status, department, test, received-date
  range and an *overdue-only* toggle; live result count and filtered CSV export.
- **Analytics & Research** — Chart.js bar/line/doughnut charts + CSV exports.
- **Help / FAQ** (`#/faq`, opened via the floating **?** button, not a nav tab) —
  task-oriented FAQ for bench staff: grouped, tap-to-expand questions covering
  logging, kits, finding tests, records, privacy and backups.

### Features

- **Local-first persistence** — all data lives in `localStorage` (keys prefixed `glab_v1_`),
  with a forward schema-migration path (currently schema v4, adding a `ncrs` collection,
  kit lots, and log workflow/result fields). The storage layer is isolated in a `Store`
  adapter, ready to swap for a real backend (e.g. Supabase) later.
- **Roles** — Bench technician / Lab manager / Geneticist / Administrator, each with its
  own permissions (logging, stock, kits, catalog, exports, QC). Set from the name/role
  pill in the header; layered on top of the admin passphrase.
- **Command palette** — `Ctrl/⌘ + K` opens a fuzzy launcher to jump to any screen, test,
  record or action (log a test, toggle theme, reorder kits, log a QC issue, export…).
- **Workflow stages & phased turnaround** — an *In Progress* request moves through
  protocol-specific sub-stages (e.g. NGS: Accessioned → Extraction → Library Prep →
  Sequencing → Analysis). Turnaround splits into **pre-analytic** and **analytic** phases;
  the dashboard surfaces both *overdue* (breached) and *due-soon* (≥80% of goal) requests.
- **Quality / non-conformances (QC)** — a lightweight NCR log (repeat, contamination,
  insufficient sample, QC failure…) with severity and CAPA, optionally linked to a record.
  Open issues are badged in the header and on the dashboard.
- **Printable report** — generate a clinical report (with ACMG/AMP interpretation,
  result narrative and reference guidelines).
  - _Accession label + scannable **Code 39 barcode** is deferred for now — the UI button is
    hidden (`logCanLabel:false`), but the `printLabel()` / `code39()` code is kept and still
    covered by the self-test suite, so it can be re-enabled later by flipping that flag._
- **Admin mode** — a SHA-256 passphrase gate unlocks the data tools and Administrator
  role. It is a workflow guard, not real security.
- **Audit trail** — every change is stamped with the actor's name and timestamp;
  viewable and CSV-exportable.
- **Kit-consumption engine with lot tracking** — kits hold dated **lots**; moving a log to
  *In Progress* / *Reported* deducts stock **first-expire-first-out**, and reverting
  restores it. Negative stock is allowed and surfaced. Low/out kits offer a one-click
  **reorder draft** (manufacturer + catalog #, suggested quantities).
- **Turnaround (TAT) tracking** — working-days or calendar-days basis, with overdue,
  due-soon and missed-goal detection.
- **Analytics** — tests/month, turnaround trend, department / age / sex breakdowns, plus a
  **turnaround-distribution histogram**, a **status funnel**, and a **test-volume
  heatmap** (test × month).
- **Backup / restore** — full JSON export and import (includes QC records).
- **Anonymized by design** — no patient names, dates of birth, or medical record numbers
  are ever collected; only bucketed age group, sex, department, test type and turnaround.
- **Light / dark theme** with system-preference detection.

## Architecture

Everything is in `index.html`. The script is organized as:

- **A tiny render runtime** (`Runtime`): batched `setState`, a focus-preserving DOM
  *morph* (so typing in inputs survives re-renders), and event delegation via `data-ev`.
- **The `App` class**: all business logic — seed data, schema migration, stats, TAT,
  kit reconciliation, audit, exports — ported verbatim from the design component, plus
  `template()` methods that render each view to HTML strings.

The UI is built on a small **design-system layer** (the `gl-*` CSS classes in the
`<style>` block): touch-friendly controls sized for bench use (44–56px targets),
segmented choice buttons, consistent inputs/selects, and visible focus rings.

The original handoff bundle is preserved under `_handoff/` for reference.

## Tests

Critical business logic ships with an in-file **self-test suite** — no build, no
runner, no dependencies. Open the app with the `selftest` flag:

```
index.html?selftest
```

It builds isolated `App` instances and asserts the pure-ish logic (HTML escaping,
working-day TAT math, `tatInfo` breach states, the kit-consumption engine,
`validateLog`, accession-number generation, dashboard stats, schema migration).
Results print to the **browser console** (PASS/FAIL per case + a summary) and are
mirrored into a full-screen overlay; the page `<title>` also reflects the result.

To run it headlessly (used during development):

```bash
chrome --headless=new --dump-dom "http://localhost:8000/index.html?selftest" \
  | grep -o 'data-pass="[0-9]*" data-fail="[0-9]*"'
```

The suite has no effect on normal use — it only runs when the flag is present.

## Data reset

Admin → gear menu → **Reset all data** wipes `localStorage` and re-seeds the demo data.
Or clear it manually in dev tools (keys beginning `glab_v1_`).

## Help & FAQ — illustrated guides

The Help & FAQ screen (`#/faq`, or the floating **?** button) is a card grid.
Procedural cards open a modal with a real screenshot for each step; concept cards
open a short text explanation. Everything is rendered from one data array —
`faqData()` in `index.html`. Adding a guide means adding one entry there plus its
screenshots; no markup changes.

Screenshots live in `assets/guides/<guide-id>/step-NN.png` (light) and
`step-NN-dark.png` (dark) and are generated from the running app:

```bash
node tools/capture-guides.mjs            # all guides, light + dark
node tools/capture-guides.mjs log-test   # just one guide
node tools/verify-faq.mjs                # smoke-test the FAQ UI
```

The app runs straight from `file://` (no server, no Chromium flags). The capture
scripts import Playwright; if it is only installed globally, link it once with a
local `node_modules` junction pointing at the global modules folder.
