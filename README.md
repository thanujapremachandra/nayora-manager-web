# Nayora Clothing — Order & Stock Management PWA

A production-quality PWA for Nayora Clothing (Kandy) to manage orders, stock, and courier dispatch — replacing the manual WhatsApp-order → logbook → courier-Excel workflow.

---

## Quick start

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Copy your project URL and API keys.

### 2. Run the database migrations

In the Supabase dashboard → **SQL Editor**, run each file in `supabase/migrations/` **in order**:

| File | What it does |
|---|---|
| `001_initial.sql` | All core tables, RLS policies, storage bucket, seed settings row |
| `002_add_order_exchange.sql` | Adds the exchange-order flag |
| `003_dispatch_batch_tracking.sql` | Lets "Complete session" be undone precisely |
| `004_search_indexes.sql` | Trigram + btree indexes so order search scales |
| `005_export_columns.sql` | Flat courier charge, `export_columns` table (courier Excel layout), seeds your real 13-column layout |
| `006_analytics_views.sql` | Two read-only views that power the Home dashboard |

### 3. Create your operator account

In Supabase dashboard → **Authentication → Users → Add user**, create the business email/password. There is no self-registration — the app is single-business.

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role key |

### 5. Generate PWA icons (one-time)

```bash
npm install --save-dev sharp
node scripts/generate-icons.js
```

Produces `public/icons/icon-192.png` and `icon-512.png` from the SVG source — required for the app to be installable as a PWA.

### 6. Run the app

```bash
npm run dev         # development
npm run typecheck   # tsc --noEmit
npm run build        # production build
npm start             # production server
```

---

## How the workflow maps to the app

1. **Stock** (`/stock`) — products, attributes (Colour/Size/…), the variant combination grid, global or per-variant pricing/cost, images, and manual stock adjustments. Every on-hand/reserved change is journaled in `stock_adjustments`.
2. **Orders** (`/orders`) — create a **session** (a dispatch batch), add orders with the fast item picker (reserves stock immediately, warns-but-allows oversell as a tracked backorder), freeze/unfreeze, multi-select mark-sent, inline tracking numbers. **Complete session** dispatches all pending orders at once and can be undone.
3. **Export & print** (from inside a session) — **Export to Excel** (column layout fully configurable in Settings), **Print slips** (4-up A4, duplex, COD box, blank space for the tracking sticker), **Print summary** (the slip's back content, standalone). All three skip frozen/cancelled/returned/issue orders automatically.
4. **Home** (`/`) — session COD trend, top items by quantity/revenue, stock value & health, profit, and frozen/issue counts that link straight into a filtered Stock or Orders view.

---

## Key things worth knowing before you touch the code

- **Stock truth.** `available = on_hand - reserved`, always derived, can go negative (a tracked backorder). Every quantity change funnels through `src/lib/db/stock-adjustments.ts` for the audit trail — never write `on_hand`/`reserved` directly.
- **Order stock is a state machine.** An order's stock claim is always `reserved`, `deducted` (sent), or `none`. `stockStateFor`/`targetStockState` in `src/lib/order-helpers.ts` and `transitionStock` in `src/lib/db/orders.ts` handle every transition uniformly — including reverting a sent order back to pending, which correctly restores stock.
- **Courier charge is flat**, not weight-tiered (`settings.default_courier_charge`, default Rs. 450) — there's no real weight-tier data, so the earlier tiered design was dropped in favour of this. Weight is still tracked and entered as kg+g for the Kilo/Gram export columns.
- **The Excel export has no uploaded template to preserve** (file uploads weren't available when this was built) — instead, the column layout is fully configurable in **Settings → Excel Export** (add/remove/reorder columns, pick a data source, set fallback values) and seeded with the real 13-column layout the business uses. The sheet is generated fresh on each export via `exceljs`, dynamically imported so it doesn't bloat the Orders page bundle.
- **Duplex slip printing assumes long-edge flip** (the standard default for portrait A4 duplex). `src/components/print/duplex-slip-view.tsx` mirrors the back page's grid positions to match — **this hasn't been tested against a real printer**. If backs land misaligned, switch your printer to long-edge flip rather than expecting different output here.
- **Queries are indexed/targeted, not fetch-and-filter.** Order volume is expected to be high, so search (`searchOrders`), the dashboard (`order_financials`/`order_item_sales` views), and session counts all use targeted, indexed queries instead of pulling broad result sets into JS.

---

## Project structure

```
src/
├── app/
│   ├── (protected)/            # all authenticated pages
│   │   ├── layout.tsx          # server auth check + nav shell
│   │   ├── page.tsx            # Home dashboard
│   │   ├── stock/               # Stock manager
│   │   ├── orders/              # Order handler
│   │   └── settings/            # Settings (General + Excel Export tabs)
│   ├── print/                   # Slip / summary print views (own layout, no nav)
│   └── login/
├── components/
│   ├── auth/, nav.tsx, pwa-register.tsx
│   ├── stock/                   # Product dialog, variant grid, adjustments
│   ├── orders/                  # Session list/detail, order dialog, item picker
│   ├── settings/                # General form, export column manager
│   ├── home/                    # Dashboard cards + hand-rolled SVG trend chart
│   ├── print/                   # Slip front/back, duplex layout, summary, shared print CSS
│   └── ui/                      # Dialog (native <dialog>-based), ConfirmDialog, WeightInput
├── lib/
│   ├── supabase/                # client.ts, server.ts (TypedClient), types.ts (hand-written schema)
│   ├── db/                      # One file per domain area — products, orders, sessions,
│   │                              stock-adjustments, dismissed-alerts, storage, settings,
│   │                              export-columns, analytics
│   ├── stock-helpers.ts, order-helpers.ts, pricing.ts, export-helpers.ts, export-excel.ts
├── middleware.ts                 # Auth guard
supabase/
└── migrations/                   # 001 through 006, run in order — see table above
```

---

## Generating real Supabase types

The hand-written `src/lib/supabase/types.ts` works, but once you have a live project, regenerate it for accuracy:

```bash
npx supabase gen types typescript \
  --project-id YOUR_PROJECT_ID \
  > src/lib/supabase/types.ts
```

Note: `TypedClient` in `src/lib/supabase/client.ts` works around a `@supabase/ssr` typing quirk (see the comment there) — keep that wrapper even after regenerating types.

---

## Milestone status

| # | Feature | Status |
|---|---|---|
| 1 | Project setup, auth, settings, PWA | ✅ Done |
| 2 | Stock manager | ✅ Done |
| 3 | Sessions & orders | ✅ Done |
| 4 | Exports & printing | ✅ Done |
| 5 | Home analytics | ✅ Done |
| 6 | Polish pass | ✅ Done |

## Known gaps / things to verify with real use

- Duplex slip printing is untested against a real printer (see above).
- No headless browser was available while building this, so UI was verified via build/typecheck/curl smoke tests rather than visual testing — give the app a real click-through, especially the order dialog and print views, before relying on it day-to-day.
- PWA icons need generating once (step 5 above) before the app is installable.
