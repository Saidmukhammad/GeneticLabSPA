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

Seven views, routed by URL hash (`#/dashboard`, `#/catalog`, …):

- **Dashboard** — live KPIs, overdue (TAT-breach) alerts, recent activity, most-requested tests.
- **Tests Catalog** — searchable/filterable card grid; full test-detail modal.
- **Test Finder** — clinician-facing reverse lookup by condition / scenario / gene / drug.
- **Departments** — expandable list of which department orders which tests.
- **Kit Inventory** — stock table with low/out/expiring flags and quick +/- adjust.
- **Log Test** — anonymized test-request form with validation and kit consumption.
- **Analytics & Research** — Chart.js bar/line/doughnut charts + CSV exports.

### Features

- **Local-first persistence** — all data lives in `localStorage` (keys prefixed `glab_v1_`),
  with a forward schema-migration path (currently schema v3). The storage layer is
  isolated in a `Store` adapter, ready to swap for a real backend (e.g. Supabase) later.
- **Admin mode** — a SHA-256 passphrase gate unlocks adding/editing tests, kits and
  departments. It is a workflow guard, not real security.
- **Audit trail** — every change is stamped with the actor's name and timestamp;
  viewable and CSV-exportable.
- **Kit-consumption engine** — moving a log to *In Progress* / *Reported* deducts kit
  stock; reverting restores it. Negative stock is allowed and surfaced.
- **Turnaround (TAT) tracking** — working-days or calendar-days basis, with overdue and
  missed-goal detection.
- **Backup / restore** — full JSON export and import.
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

The original handoff bundle is preserved under `_handoff/` for reference.

## Data reset

Admin → gear menu → **Reset all data** wipes `localStorage` and re-seeds the demo data.
Or clear it manually in dev tools (keys beginning `glab_v1_`).
