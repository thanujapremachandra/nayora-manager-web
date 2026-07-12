# Nayora Clothing — Order & Stock Management PWA
### Build spec for Claude Code

You are building a production-quality **PWA** for a small Sri Lankan clothing business ("Nayora Clothing", Kandy) to replace a manual workflow: reading WhatsApp orders, writing them in a log book + courier books, and retyping into a courier's Excel format. The app must kill that retyping, track stock truthfully (no more eyeballing), and make daily order dispatch fast.

Read this whole file before writing code. Build in the milestone order at the bottom. Commit after each milestone. Where something is marked **[CONFIRM WITH USER]**, build it configurable and leave a clear TODO + a settings UI rather than hardcoding a guess.

---

## 1. Stack & ground rules

- **Next.js (App Router) + TypeScript + Tailwind CSS.**
- **Supabase**: Postgres (data), Auth (email/password, single business, RLS on every table), Storage (variant images).
- **PWA**: web manifest + service worker, installable on phone & desktop, app shell cached for offline read. Use `next-pwa` or a hand-rolled SW — your call, but it must actually install.
- **Responsive**: desktop (dense tables, right-click menus) and mobile (thumb-friendly, long-press menus, bottom nav). Both are first-class.
- **Currency**: LKR, display as `Rs. 1,250` (no decimals unless needed).
- Use a typed Supabase client (generate types from the schema). No `any` in domain code.
- Keep data access in a small typed service layer (`/lib/db/*`) so the UI never writes raw queries inline.
- Don't over-engineer. No state-management library unless genuinely needed (server components + React Query/SWR is plenty). Every screen needs loading, empty, and error states with plain, actionable copy.
- Provide `.env.local.example` (below) and a `README` with setup + the SQL migration to run.

### `.env.local.example` (user fills these)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_NAME=Nayora Clothing
```
Ship all Supabase schema as a SQL migration in `/supabase/migrations` so the user runs one command (or pastes into the SQL editor) and the DB is ready. Include RLS policies (authenticated users full access; anon none).

---

## 2. The three pages

1. **Home** — analytics dashboard.
2. **Stock manager** — products, variants, prices, stock. Full CRUD.
3. **Order handler** — sessions, orders, exports, slips. Full CRUD.

Everything else (forms, pickers, detail views) lives in **dialogs / slide-overs / popovers**, not separate routes, so the operator never loses context.

---

## 3. Data model

Design these as Postgres tables. `available` is always **derived**: `available = on_hand - reserved` (can go negative = backorder).

- **settings** (singleton row): business_name, address, phone1, phone2, slip_footer_text, default_low_stock_threshold (int), courier_tiers (jsonb), currency ('LKR').
  - `courier_tiers` shape: weight-based charge that changes past a threshold. Default placeholder `[{ "max_grams": 1000, "charge": 0 }, { "max_grams": null, "charge": 0 }]` — **[CONFIRM WITH USER]** the real weight cutoff and the two charges. This is what the courier *deducts*; it is separate from the COD amount.
- **products**: id, name, price_mode ('global' | 'variant'), global_price (nullable), global_cost (nullable), low_stock_threshold (nullable → falls back to settings default), created_at, updated_at.
- **product_attributes**: id, product_id, name, position. (e.g. "Colour", "Size". Start with 2, but the schema and grid UI must support N attributes.)
- **attribute_values**: id, attribute_id, value, position. (e.g. Blue, Purple / L, XL, XXL.)
- **variants**: id, product_id, name (nullable override), image_url (nullable), on_hand (int, default 0), reserved (int, default 0), price (nullable → falls back to global when price_mode='global'), cost (nullable → global), created_at. A variant = one combination of attribute values.
- **variant_attribute_values**: variant_id, attribute_value_id. (Join defining each variant's combination.)
- **stock_adjustments** (audit log, append-only): id, variant_id, delta (int, signed), reason ('restock' | 'damage' | 'correction' | 'reserve' | 'release' | 'sold' | 'restore'), note, order_id (nullable), created_at. All on_hand / reserved changes flow through here so history is never lost.
- **sessions**: id, name (default = date), status ('pending' | 'completed'), created_at, completed_at.
- **orders**: id, ref_id (our human-friendly generated ID, e.g. `NYR-0007`), session_id, customer_name, address, phone1, phone2 (nullable), payment_type ('cod' | 'bank'), order_discount (nullable, money), weight_grams (nullable), status ('pending' | 'frozen' | 'issue' | 'sent' | 'returned' | 'cancelled'), freeze_stock_mode ('reserved' | 'released', nullable, set only when frozen), remarks, created_at, updated_at. `cod_amount` and `courier_charge` are computed (see §6) but may be overridden.
- **order_items**: id, order_id, variant_id, qty, unit_price (override-able; defaults from variant/global at add time), line_discount (nullable), created_at.
- **order_tracking**: id, order_id, tracking_number, created_at. (Courier gives tracking IDs as stickers; an order can have several.)
- **dismissed_alerts**: id, alert_key (text, e.g. `low_stock:<variant_id>`), dismissed_at. Used so warnings don't nag repeatedly.

**No customers table.** Repeat-customer handling is done by querying past `orders` by phone number (see §5, soft key). Do not build a customer entity.

---

## 4. Stock manager (page 2) — build first, everything reserves against it

### Product + variants
- Create a product with a name, then define **variant attributes** (add/remove/rename, reorder). Two by default (e.g. Colour, Size) but the UI must let them add a 3rd, 4th, etc., and the combination grid must regenerate accordingly.
- **Combination grid**: rows × columns from the first two attributes; if >2 attributes, generate the full cartesian set as a flat editable list grouped sensibly. Each cell/row holds **stock (on_hand)**, **price**, **cost**.
- **Pricing toggle per product**: "Same price for all variants" (global) vs "Set per variant". When global, show one price+cost for the whole item and grey out per-cell price; when per-variant, each variant gets its own. Cost is tracked the same way (needed for profit).
- **Per variant**: optional image (Supabase Storage; compress client-side before upload), optional name override.
- **Product card** shows the item with its variant breakdown (thumbnails, stock per variant, price range, total stock value).
- **Full CRUD** on products, attributes, values, variants.

### Stock truth & reservations (critical)
- Show three numbers per variant: **on hand**, **reserved**, **available (= on hand − reserved)**.
- Reservations are driven by orders (see §5): adding an order reserves immediately; freezing asks reserve-or-release; sending deducts on_hand; deleting/cancelling releases. All via `stock_adjustments`.
- **Manual adjustments**: a dialog to restock / mark damaged / correct miscount, each with a reason + note, written to `stock_adjustments`.

### Oversell & backorder
- A variant with `available <= 0` shows as **Not available** in the picker, but if the operator **explicitly picks it**, warn ("Only N available — add anyway?") and **allow** it (they may have received unlogged stock). The excess makes `available` go negative = a tracked backorder.
- On a **restock** that lifts a backordered variant, surface a notice: "Orders #… added this item while it was out. Deduct from the new stock?" → **Yes** deducts against those orders' reservations; **No** leaves them as a fresh start. Compute the affected orders from `order_items` with outstanding shortfall.

### Warnings & filters
- Low-stock warnings must be **dismissible and not reappear** for that variant (use `dismissed_alerts`); a new drop below threshold after a restock may re-arm it.
- Filters beyond low stock: **in stock / low stock / out of stock / backordered**, filter by attribute value (e.g. all "XL"), search by name, and sort by stock value / quantity / name.

---

## 5. Order handler (page 3) — the core of the workflow

### Sessions
- Operator creates a **session** (daily, but inconsistent — so it's manual). A new session is **pending**.
- Orders added to a pending session are **pending** by default.
- **Mark session complete** sets it (and its qualifying orders) to **sent to courier** — that's "done on our part"; we never track beyond *sent*. **But** individual orders can be marked sent/finished without completing the whole session.
- Completing a session that still contains **frozen** orders must prompt: *"This session has N frozen orders — proceed without them?"*

### Order form
- Fields: customer_name, address, **phone1**, optional **phone2** (max 2 numbers), payment_type (COD / bank transfer), remarks.
- **Soft key (repeat customers, no customer entity)**: as they type a phone number, offer an **autofill dropdown** from past orders matching that number (name + address). Picking one fills the fields.
  - If the **same number already has an order in the current session**, show a **dismissible side warning**.
  - If the number appears in **history beyond this session**, show it on the side as **"Previous orders"**, each **clickable → opens a nice popup** summarising that past order (items, address, date, COD) so they can eyeball cross-reference.

### Item picker (fast, the part that must feel instant)
- A **+ button** opens a product list **with search**.
- Selecting a product reveals its **variants with images** and its **attribute values as clickable chips** (e.g. tap "Blue", tap "XL"). Adding a variant adds a line with a **qty** field.
- Must support stacking **multiple products** and **multiple sizes/colours of the same product** quickly, each with its own qty. Keyboard-friendly on desktop, tap-friendly on mobile.
- Picking a variant **reserves stock immediately** (respecting the oversell rule in §4).

### Per-order freeze
- Any order in a session can be **frozen** ("in the session but not sending yet, come back later").
- Freezing **asks: keep stock reserved, or release it back to the pool?** Store as `freeze_stock_mode`; apply the matching `stock_adjustment`.
- Frozen orders can be **unfrozen** (re-reserves, warns if that would oversell) and dealt with separately inside the session.
- **Exports automatically skip frozen orders.**

### Status, editing, tracking
- Statuses: pending → (frozen / issue) → sent → and post-send edits like **returned / cancelled** (e.g. an order that didn't go even after being sent). Full CRUD on orders and their items; status is freely editable.
- **Multi-select** orders in the session to mark **sent to courier** in bulk.
- **Tracking IDs**: each order row in the session list has an **inline empty field** — click/expand the row to add a tracking number with no extra windows; **right-click (desktop) / long-press (mobile)** on the row also offers "Add tracking". An order supports **multiple** tracking numbers (`order_tracking`).
- **Search** across orders (ref id, name, phone, tracking, item).

### Discounts
- **Per-item unit-price override** (e.g. an item is Rs. 900 but this one line goes out at Rs. 850) — default is automatic pricing; the override only appears when toggled on for that line.
- **Order-level discount** also available, behind a toggle. Show neither by default; surface only when the operator wants it.

---

## 6. Pricing, COD & courier charge

- **Order item total** = Σ(unit_price × qty − line_discount) − order_discount.
- **COD amount** = the order item total = **what the courier collects** and what prints in the slip's COD box.
- **Bank transfer**: `payment_type='bank'` → **COD box prints 0**; instead the operator writes the **ref id** in the empty space and pastes the **tracking sticker** (so the slip's blank area must accommodate this — see §7).
- **Courier charge** = derived from `settings.courier_tiers` using `weight_grams` (a weight cutoff past which the charge changes — two tiers). This is the courier's deduction, tracked for analytics, **not** added to the customer's COD. **[CONFIRM WITH USER]** exact cutoff + charges; until then read from settings with safe defaults and make it editable in Settings.

---

## 7. Exports & printing

Three outputs. All **exclude frozen orders** automatically and operate on a chosen session (or selected orders).

1. **Courier Excel.** The user uploads their courier's **base .xlsx template**; the app fills *that exact format* on export.
   - Use **`exceljs`** so the template's formatting/headers are preserved; write order rows into the right columns.
   - **[CONFIRM WITH USER — template not provided yet]**: build a small **column-mapping screen** that reads the uploaded template's header row and lets the user map each column → an order field (name, address, phone, COD, ref id, weight, tracking, etc.). Persist the mapping so future exports are one click. One row per order. Skip frozen.

2. **Courier slips (print + PDF).** Premade layout — reproduce the provided slip:
   - Header: **"Nayora Clothing"** (centered, bold).
   - Left block: `Name :-` , `Address :-` (multi-line), `Phone Numbers :-` — filled from the order.
   - Right column: **`COD ____`** = the COD amount (0 for bank transfer).
   - Footer (fixed, from settings): `Nayora Clothing — No 16, Kumudu Mawatha, Primrose Gardens, Kandy — 0774774670 / 0777898768`.
   - Leave the blank space usable for hand-writing the ref id / pasting the tracking sticker (esp. bank-transfer orders).
   - **Layout: 4 slips per A4 (2×2 grid).** Use precise `@page { size: A4 }` print CSS in millimetres so it tiles cleanly and prints crisp.
   - **Double-sided / duplex**: front page = 4 slip **fronts**; the following page = the matching 4 **backs** = an **order summary** (ref id + the item list for that order), positioned to line up with its front under duplex printing.
   - Provide both a **print view** (browser print dialog) and a **PDF** download.

3. **Order summary / details sheet** = the slip's back content as a standalone printable too (ref id + items), in case they want it separately. PDF + print.

---

## 8. Home (page 1) — analytics

Use your judgement; make it genuinely useful at a glance:
- Orders count & **COD revenue** per session and over time (a simple trend).
- **Top items / variants** by quantity and revenue.
- **Current stock value** (on_hand × cost, and × price), low-stock and **backordered** counts.
- **Frozen / issue** counts needing attention.
- **Profit** view (selling − cost) since cost is tracked.
- Quick links into the relevant filtered views.

Keep it calm and scannable, not a wall of gauges.

---

## 9. Quality bar

- Mobile + desktop both polished; visible keyboard focus; respects reduced motion.
- Optimistic UI where safe; never lose an in-progress order on a misclick (confirm destructive actions).
- All money/stock mutations go through the typed service layer and write audit rows where relevant.
- Distinct, legible states for **available / reserved / oversold / frozen / sent** (colour + label, never colour alone).
- Plain, active-voice copy. Buttons say what they do ("Mark sent", "Freeze order", "Add tracking"). Empty states invite the next action.

---

## 10. Build order (commit after each)

1. **Project setup**: Next.js + TS + Tailwind + Supabase client + PWA shell + auth (login screen, protected routes) + the SQL migration with all tables + RLS + a Settings page seeded with the business info from §7.
2. **Stock manager**: products, attributes, variant grid, global/per-variant pricing + cost, images, manual adjustments, filters, dismissible warnings, full CRUD. (Reservation fields present; wired in step 3.)
3. **Sessions + orders**: session lifecycle, order form with soft-key autofill + dup/previous side panels, the fast item picker with live reservation, statuses, freeze (reserve/release), unfreeze, multi-select sent, inline tracking, discounts toggle, search, full CRUD. Wire oversell + backorder + restock notifications.
4. **Exports & printing**: courier Excel with the upload + column-mapping screen; 2×2 A4 slip print + duplex back summary; PDF; standalone summary sheet.
5. **Home analytics.**
6. **Polish pass**: responsive/a11y/print-CSS review, error/empty states, README + setup docs.

**Before each milestone, restate your plan in 3–4 lines and flag any assumption.** Ask the user for the **courier Excel template** and the **courier weight/charge tiers** when you reach milestones 4 and 1 respectively — don't block earlier work on them.
