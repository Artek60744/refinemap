---
type: Architecture
title: Frontend SPA — Routes, Pages and i18n
description: The React 18 + TypeScript + Vite + Tailwind frontend of RefineMap — client routes, the pages behind each route (including the product-memory curation surface), the navigation shells, the API client, the shared i18n catalog with the lang cookie, and the build/validation commands.
tags: [frontend, react, typescript, vite, i18n]
openwiki:
  roles: [architecture]
  change_kinds: [runtime]
  source_paths: [frontend/src/App.tsx, frontend/src/pages/WarRoom.tsx, frontend/src/pages/HistoryPage.tsx, frontend/src/pages/ProductMemoryPage.tsx, frontend/src/pages/RefinementHome.tsx, frontend/src/pages/SettingsPage.tsx, frontend/src/api/client.ts, frontend/src/api/refinement.ts, frontend/src/api/memory.ts, frontend/src/components/TopNavBar.tsx, frontend/src/components/Layout.tsx, frontend/src/i18n/catalog.ts]
  symbols: [App, WarRoom, HistoryPage, ProductMemoryPage, RefinementHome, SettingsPage, ChooseGrid, SessionResultPage, MemoryBanner, TopNavBar, Layout, apiFetch, LanguageProvider, useI18n]
  invariants: ["The SPA never calls an LLM; all AI work goes through /api. The lang cookie is shared with the backend. Theme grouping in the War Room derives from the free-string question theme, exactly like the backend brief grouping. Memory corrections in the War Room and on the /memory page write straight to the product memory through the API, never to a local-only copy."]
  validation_commands: [cd frontend && npm run build]
---

# Frontend SPA — Routes, Pages and i18n

The frontend is a React 18 + TypeScript SPA built with Vite and styled with Tailwind
CSS v4. It speaks only to the FastAPI backend over JSON; it never calls an LLM
directly. In production nginx serves the built bundle and proxies `/api` and
`/health`; in dev, Vite proxies the same paths to `http://localhost:8000`
(override with `BACKEND_URL`).

## Routes (`frontend/src/App.tsx`)

| Route | Page | Purpose |
|---|---|---|
| `/` and `/refinement` | `RefinementHome` | Capture the raw idea and pick the product scope (which memory feeds the session) |
| `/refinement/choose` | `ChooseGrid` | Pick posture (PO / Technique / Hybride) — guarded: redirects home without an objective in location state |
| `/refinement/sessions/:sessionId` | `WarRoom` | The main 3-zone refinement screen |
| `/refinement/sessions/:sessionId/result` | `SessionResultPage` | Final deliverable read-only view |
| `/refinement/history` | `HistoryPage` | Session list, search, status filter, rename, delete, re-export |
| `/memory` | `ProductMemoryPage` | Product memory curation: product list, facts grouped by category, add / edit / confirm / archive |
| `/settings` | `SettingsPage` | LLM provider configuration and connection test |
| `*` | redirect | Unknown routes -> `/refinement` |

## Navigation shells

Two shells, chosen per route in `App.tsx`:

- **`TopNavBar`** — fixed top bar with Dashboard / History / Memory links plus
  right-side children (settings, avatar). Used by `RefinementHome`, `HistoryPage`
  and `ProductMemoryPage` (`active` prop highlights the current tab).
- **`Layout`** — sidebar shell with Refinement / History / Memory / Settings /
  Health links and the language switcher. Used by `SessionResultPage` and
  `SettingsPage` via the nested `<Route element={<Layout />}>` block in `App.tsx`.
- `WarRoom` renders its own chrome (the top bar is a commented-out placeholder)
  because it is the core screen with its own three-zone layout.

## War Room (the core screen)

`WarRoom.tsx` renders three zones from `SessionDetailResponse`:

- **Intent Structure** (left) — the theme tree with per-question answered/total
  progress. Theme grouping is derived client-side from the free-string
  `question.theme` via `themeKey()` — the same grouping axis the backend uses for
  Brief sections, so renaming an axis label must update both sides.
- **Decision War Room** (center) — the conversation: one question at a time with
  one-click `suggestions` chips, chronological ordering for the open round
  (`openRoundOrder` keeps answered exchanges first, then the active question, then
  pending axis questions in server order), per-round dividers, and local answer
  state until the round is submitted via `POST /answers`.
- **Deliverable** (right) — live Brief / Plan / Code Draft preview tabs and the
  Markdown export link; when a `decisionReport` exists, `DecisionReportView`
  renders the verdict banner with root cause / blockers / next action (see
  [decision-report.md](../domain/decision-report.md)).
- **Memory banner (round-0 pre-flight)** — when the session is scoped to a
  product, the injected facts appear in a collapsible `MemoryBanner` above the
  first question. Correcting or removing a line **writes straight to the product
  memory** via `updateMemoryFact` / `archiveMemoryFact` — never to a local copy —
  because that feedback loop is what keeps memory trustworthy over time.

It also owns: grid change (posts `/mode`, which resets rounds server-side),
`degraded` banner when the backend used the offline engine, and the clarity score
derived from `confidence` (`clarityFromConfidence`: high 85, medium 68, low 40, 100
with a final deliverable).

## Home, history, memory, result and settings pages

- `RefinementHome` — objective textarea plus a **product scope selector** that
  decides which memory feeds the session: the picker lists the user's products
  (with active fact counts), offers a `__new__` sentinel option that creates a
  product by name at session start, and an empty choice means "session without
  memory". A `listProducts` failure never blocks starting a session (comment in
  `RefinementHome.tsx`).
- `ProductMemoryPage` — the curation surface at `/memory` (see
  [product-memory.md](../domain/product-memory.md)): product list with fact
  counts, facts grouped by category in the display order that mirrors
  `MEMORY_CATEGORIES` (`src/models/product_memory.py`), inline add / edit /
  confirm / archive, and the 40-fact cap surfaced in the UI
  (`FACT_LIMIT` mirrors `MEMORY_FACT_LIMIT`).
- `HistoryPage` — paginated list (20/page) with debounced search, status filter,
  inline rename, delete confirmation, and re-export; "load more" appends instead of
  resetting the page.
- `SessionResultPage` — read-only view of the final deliverable.
- `SettingsPage` — provider-aware form: required fields per provider
  (`LLM_FIELDS_BY_PROVIDER`: mock none, deepseek model, azure endpoints +
  deployment, openai/openrouter model), masked key hint, connection test result
  panel. The API key field is only sent when non-empty (server keeps the stored
  key), matching the backend rule in
  [llm-configuration.md](../operations/llm-configuration.md).

## API client and types

- `frontend/src/api/client.ts` — `apiFetch` wrapper: JSON headers, error extraction
  from `detail` / `message` / `error.message` into an `ApiError` with status.
- `frontend/src/api/refinement.ts` — typed functions for every refinement endpoint
  (`createSession`, `listSessions`, `renameSession`, `deleteSession`, `getSession`,
  `setSessionMode`, `submitAnswers`, `exportUrl`).
- `frontend/src/api/memory.ts` — typed functions for products and facts
  (`listProducts`, `createProduct`, `deleteProduct`, `getProductMemory`,
  `addMemoryFact`, `updateMemoryFact`, `archiveMemoryFact`), backing the
  `ProductMemoryPage` UI, the War Room memory banner, and the home product
  picker.
- `frontend/src/api/settings.ts` — `getSettings`, `saveSettings`, `testLlm`.
- `frontend/src/types/api.ts` — mirrors the backend Pydantic schemas 1:1 (with the
  same comments); keep it in sync with `src/api/schemas_refinement.py` and
  `src/api/schemas_settings.py` when schemas change.

## i18n

- `frontend/src/i18n/catalog.ts` — the UI catalog (`key -> [english, french]`,
  default French), including the `lang` cookie name `lang`, the `nav.*` link
  labels (dashboard / history / memory), and the whole `memory.*` namespace used
  by the home product picker, the War Room banner and `ProductMemoryPage`.
- `frontend/src/i18n/index.tsx` — `LanguageProvider` reads the `lang` cookie or
  `navigator.language`, and `setLang` **writes the same cookie the backend reads**
  (path `/`, 1 year, SameSite=Lax) so API messages and prompt language follow the
  UI without an extra round-trip. `t(key, params)` formats `{placeholders}`;
  `label(prefix, value)` maps enum values through the catalog with raw fallback.
- The backend keeps its own, smaller catalog for API messages in `src/i18n.py`
  (see [architecture/overview.md](../architecture/overview.md)).

## Change guidance

- **When to consult this page:** any UI change, route addition, i18n string, or
  type/schema sync work.
- **Invariants to preserve:** SPA never calls an LLM; single-origin routing
  (Vite/nginx proxy for `/api` and `/health`); `lang` cookie shared with the
  backend; theme-grouping derivation identical to backend brief grouping.
- **Extension seams:** new page -> add route in `App.tsx`; new endpoint -> add
  typed function in `api/refinement.ts`, `api/memory.ts` or `api/settings.ts`
  plus types in `types/api.ts`; new UI string -> add the `[en, fr]` pair in
  `catalog.ts` (never a hardcoded user-facing string).
- **Testing:** there is **no frontend test suite**; the enforced checks are
  `tsc --noEmit` and `vite build`, both behind `npm run build`. Adding a component
  test setup would be a new toolchain decision, not an incremental fix.
- **Validation:** `cd frontend && npm run build` (typecheck + production build);
  for interactive work `npm run dev` with the backend running.
