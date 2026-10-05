# UI / Page Specification

**Project:** Local Handyman — v1.0 — 2 October 2026
**Companion to:** `docs/SRS.md`, `docs/DATA-MODEL-AND-API.md`
**Tags:** `[EXISTING]` built and verified · `[NEW]` agreed scope · `[PLANNED]` later release

---

## 1. Design language

### 1.1 Foundations
| Token | Rule |
| --- | --- |
| Framework | Tailwind CSS + shadcn/ui primitives (`components/ui/*` — full set present) |
| Icons | lucide-react only (consistent stroke weight) |
| Charts | recharts (`components/ui/chart.tsx`) |
| Motion | framer-motion / AOS for public marketing pages only; dashboards stay instant |
| Breakpoints | mobile-first: `sm 640` · `md 768` · `lg 1024` · `xl 1280`; primary target 360 px |
| Touch targets | ≥ 40 px height for all buttons/inputs on mobile |

### 1.2 Status badge map (single source of truth)
A shared `StatusBadge` maps every domain state → `{ label, variant, icon }`. Never colour-only: always **label + icon** (master spec §79).

| Domain | States → variant |
| --- | --- |
| Request | `open` = info · `quoted` = warning · `booking_created` = success · `cancelled/expired` = secondary/muted |
| Quotation | `pending` = warning · `accepted` = success · `rejected/withdrawn` = destructive · `changes_requested` = info |
| Booking | pipeline gradient: REQUESTED/…_SENT = secondary → `PAYMENT_DUE`/`PROOF_SUBMITTED` = warning → `PAYMENT_VERIFIED`/`SCHEDULED` = info → `IN_PROGRESS` = default → `COMPLETED`/`CLOSED` = success · `CANCELLED/REJECTED/EXPIRED` = destructive · `DISPUTED` = outline-destructive |
| JobPhase | `NOT_STARTED` = secondary · `IN_PROGRESS` = info · `AWAITING_CUSTOMER` = warning · `COMPLETED` = success · `CANCELLED` = muted |
| PaymentPhase | `UNPAID` = secondary · `PAYMENT_DUE` = warning · `PROOF_SUBMITTED/UNDER_VERIFICATION` = info · `VERIFIED` = success · `REJECTED` = destructive |
| PaymentProof | `pending` = warning · `verified` = success · `rejected` = destructive |
| WorkerProfile | `approved` = success **Verified badge** · `pending/under_review` = warning · `rejected` = destructive · `suspended` = muted |
| Ticket/Complaint/Dispute | `open` = info · `in_progress/investigating` = warning · `waiting` = secondary · `resolved/closed` = success · `dismissed` = muted |

Emergency/urgent jobs additionally render an `URGENT`/`EMERGENCY` pill (red/amber) on every surface: feed cards, request detail, booking header, notification rows, chat header.

### 1.3 Shared state kit (every data page uses all four)
1. **Loading** — `Skeleton` blocks matching final layout (never a bare spinner for lists)
2. **Empty** — icon + one-line explanation + primary CTA (examples already in code: *"Quote on a request to get your first job"*)
3. **Error** — destructive alert + `Retry` (re-invokes the same fetch)
4. **Success** — `sonner` toast + optimistic UI where safe

Confirmation dialogs (`AlertDialog`) required for: accept quotation, cancel booking, delete anything, reject proof, complete job, moderate review.

---

## 2. Layout shells

### 2.1 Public shell — `components/site/nav.tsx` `[EXISTING]`
Top bar (logo, Services, Find Workers, How it works, FAQ, Login, Register CTA) + `SiteFooter`. Sticky on scroll, hamburger below `md`.

### 2.2 Dashboard shell — `components/dashboard/shell.tsx` + `nav-config.ts` `[EXISTING]`
Role-aware sidebar (collapsible → bottom sheet / drawer on mobile via `use-mobile`):

| Role | Nav items (existing) |
| --- | --- |
| Customer | Overview, New Request, My Requests, My Bookings, Payments, Messages, Favorites, My Reviews, Profile |
| Worker | Overview, Job Requests, My Jobs, Payment Records, Portfolio, Reviews, Messages, Profile |
| Admin | Overview, Payments, Workers, Users, Bookings, Categories, CBE Accounts, Audit |

`[NEW/PLANNED]` additions to nav:
- Customer: **Quotations**, **Notifications**, **Support**, **Settings**
- Worker: **My Quotations**, **Calendar**, **Availability**, **Support**, **Settings**
- Admin: **Complaints**, **Disputes**, **Support**, **Reports**, **Announcements**, **Settings**, **Roles**

Header of shell: global notification bell (unread badge), role chip, avatar menu.

---

## 3. Page catalogue

### 3.1 Public pages `[EXISTING]`

| Route | Key sections | Data |
| --- | --- | --- |
| `/` | Hero + search, popular services, verified workers strip, how-it-works (12 steps), why-us, testimonials, FAQ preview, CTA, footer | `GET /api/categories`, `GET /api/workers?limit=6` |
| `/services` | Category tree (91), subcategory chips, link to search | `GET /api/categories` |
| `/find-workers` | Filter rail (category, city, rating, price, emergency, verified-only) + result cards + pagination | `GET /api/workers?…` |
| `/workers/[id]` | Avatar, verified badge, headline, stats (jobs, rating, response time), skills, bio, service area, availability, price, portfolio gallery, reviews, **Message** + **Request service** buttons, favourite | `GET /api/workers/[id]`, `GET /api/reviews` |
| `/how-it-works` | 12-step payment-aware flow | static |
| `/faq`, `/login`, `/register` (role toggle: Customer/Worker) | static + auth forms | `POST /api/auth/*` |
| `[PLANNED]` `/about`, `/contact`, `/terms`, `/privacy`, `/services/[id]` | static/info | — |

Forms: inline validation + server error display; password strength hint; register switches to worker-specific fields when role = worker.

### 3.2 Customer pages

| Route | Status | Data | Key actions |
| --- | --- | --- | --- |
| `/dashboard/customer` | `[EXISTING]` | `requests`, `bookings`, `payments/history`, `notifications` | stat cards + quick actions (Find worker, New request, Bookings, Payments, Messages) |
| `/dashboard/customer/requests/new` | `[EXISTING]` | `categories` | multi-step form: category → details → media upload → location/date → budget/urgency → review & submit |
| `/dashboard/customer/requests` | `[EXISTING]` | `GET /api/requests` | filter by status, open detail |
| `/dashboard/customer/requests/[id]` | `[EXISTING]` | `GET /api/requests/[id]` | **quotation comparison table** (side-by-side price/duration/warranty/rating), Accept / Reject / Request changes, cancel/close request, chat shortcut |
| `[NEW]` same page | accept-flow | — | badge for offers created via **Accept** (`source: "accept"`): *"Abebe accepted your job at 4,500 ETB — Confirm & book"* |
| `/dashboard/customer/bookings` | `[EXISTING]` | `GET /api/bookings` | status chips, search, pagination |
| `/dashboard/customer/bookings/[id]` | `[EXISTING]` | `GET /api/bookings/[id]` | tabs: **Summary** (status timeline, parties) · **Work** (phases + evidence viewer) · **Payments** (phases, CBE instructions, submit/resubmit proof dialog) · **Chat** (`ChatPanel`) · Actions: confirm completion, report problem, cancel, dispute |
| `/dashboard/customer/payments` | `[EXISTING]` | `payments/history` | totals (required/verified/pending/remaining), per-booking rows, deep-link to phase |
| `/dashboard/customer/messages`, `/[id]` | `[EXISTING]` | `conversations`, `messages` | `MessagesPage` + `ChatPanel` (15 s / 6 s polling) |
| `/dashboard/customer/favorites` | `[EXISTING]` | `favorites` | remove, open profile |
| `/dashboard/customer/reviews` | `[EXISTING]` | `reviews` | given reviews, star inputs |
| `/dashboard/customer/profile` | `[EXISTING]` | `profile`, `addresses` | edit profile, manage addresses (multiple, default flag), password change |
| `[PLANNED]` `/quotations`, `/notifications`, `/support`, `/settings` | | `notifications`, `complaints`, `support` | mark read, file complaint, preferences |

**Payment proof dialog** (inside booking → Payments tab) — must match master spec §93 exactly:

```text
Phase: Materials   ·   6,000 ETB   ·   Due Oct 5
── Pay using CBE ─────────────────────
Bank: Commercial Bank of Ethiopia
Account Name / Number / Branch / Instructions   ← from PaymentAccount
[ I HAVE PAID — SUBMIT PAYMENT PROOF ]
── then ──
UNDER VERIFICATION → ✓ PAYMENT VERIFIED
or  PAYMENT PROOF REJECTED + reason + [ RESUBMIT PAYMENT PROOF ]
```
Duplicate/under/over warnings surface as non-blocking alerts on the submitted state for the customer, and as flags in the verifier queue.

### 3.3 Worker pages

| Route | Status | Data | Key actions |
| --- | --- | --- | --- |
| `/dashboard/worker` | `[EXISTING]` | `worker/profile`, `bookings`, `requests?view=available&limit=3` | stats, availability switch, emergency switch, quick links |
| `/dashboard/worker/requests` **(universal job feed)** | `[CHANGED]` | `GET /api/requests?view=available` | **Now lists every open/quoted job from every homeowner**; optional filters: category, "Emergency & urgent only"; pagination; "You quoted" badge (server-driven after P1–P2, replacing localStorage marker) |
| `/dashboard/worker/requests/[id]` | `[CHANGED]` | `GET /api/requests/[id]` | header: title, urgency, budget, location (area-level), customer, photos · **three actions:** ① **Accept job** ② **Send quotation** ③ **Message homeowner** · existing quotation form + read-only "your quotation" card |
| Accept dialog `[NEW]` | | — | price input **prefilled with request budget** (editable — negotiated amount), optional note, summary of plan (30/40/30), confirm → toast *"Offer sent — waiting for customer confirmation"*; afterwards show state card **"Accepted ✓ waiting for customer approval"** |
| Message button `[NEW]` | | — | `POST /api/conversations {customerId}` → `router.push('/dashboard/worker/messages/'+id)`; opens booking-less thread for price talk **before** accepting |
| `/dashboard/worker/jobs` | `[EXISTING]` | `GET /api/bookings` | status chips (all/active/awaiting payment/completed/cancelled), search, "Open job" |
| `/dashboard/worker/jobs/[id]` | `[EXISTING]` | `GET /api/bookings/[id]` | status action buttons (only `allowedTransitions`), work-phase manager + evidence upload (before/during/after), payment tab (read-mostly + configure split), timeline, accepted-quotation card, `ChatPanel`; gate banner when advance not yet verified |
| `/dashboard/worker/payments` | `[EXISTING]` | `payments/history` | verified/pending/remaining — **no wallet, no withdraw** (master spec §58) |
| `/dashboard/worker/portfolio` | `[EXISTING]` | `worker/portfolio` | add/edit/remove items with before/during/after images |
| `/dashboard/worker/profile` | `[EXISTING]` | `worker/profile`, `worker/documents` | profile fields, availability, schedule, emergency flag, upload documents, resubmit-for-review banner |
| `/dashboard/worker/reviews` | `[EXISTING]` | `reviews` | received reviews + reply |
| `/dashboard/worker/messages`, `/[id]` | `[EXISTING]` | `conversations` | shared `MessagesPage` |
| `[PLANNED]` `/quotations`, `/calendar`, `/verification`, `/availability`, `/support`, `/settings` | | `quotations`, `bookings` | quotation revision history; calendar grid of jobs + payment/work-phase deadlines with conflict warnings |

### 3.4 Admin pages

| Route | Status | Data | Key actions |
| --- | --- | --- | --- |
| `/dashboard/admin` | `[EXISTING]` | `admin/stats` | stat cards + recharts (users, bookings, verified amount, proof activity) |
| `/dashboard/admin/payments` **Payment Verification Center** | `[EXISTING]` | `payments/proofs` | tabs **Pending / Verified / Rejected / All** `[NEW: Under verification, Overdue]`; queue rows enriched with booking+customer+phase; detail drawer: zoom screenshot, expected vs submitted, duplicate/under/over flags → **Verify** / **Reject (reason required)** / `[PLANNED] Request clarification` |
| `/dashboard/admin/workers` | `[EXISTING]` | `admin/workers`, `admin/workers/[id]/verify` | queue by status, document viewer, approve/reject/resubmit with note |
| `/dashboard/admin/users` | `[EXISTING]` | `admin/users` | search/filter, activate/disable/suspend, detail drawer |
| `/dashboard/admin/bookings`, `/[id]` | `[EXISTING]` | `bookings` | **unified audit view**: request → quotation → booking → messages → work phases → payment phases → proofs → verification → evidence → complaints → review (single timeline) `[PLANNED: complaints tab]` |
| `/dashboard/admin/categories` | `[EXISTING]` | `categories` | CRUD, parent/child, active toggle |
| `/dashboard/admin/payment-accounts` | `[EXISTING]` | `payment-accounts` | CRUD CBE details + instructions (never hard-coded) |
| `/dashboard/admin/audit` | `[EXISTING]` | `admin/audit` | filter by action/actor/date |
| `[PLANNED]` `/complaints`, `/disputes`, `/support`, `/reports` (+CSV/Excel/PDF export), `/announcements`, `/settings`, `/roles`, `/customers`, `/services`, `/notifications` | | new endpoints §14.1 of API spec | status workflows, investigation notes, resolution |

---

## 4. Cross-cutting components

| Component | File | Purpose / change |
| --- | --- | --- |
| `Shell` + `nav-config` | `components/dashboard/*` | role nav `[EXISTING]`; add planned items |
| `ChatPanel` | `components/dashboard/chat-panel.tsx` | text/image/file/location, 6 s poll `[EXISTING]`; `[PLANNED]` typing indicator, read receipts, reply, search |
| `MessagesPage` | `components/dashboard/messages-page.tsx` | list + unread pills, 15 s poll `[EXISTING]` |
| `StatusBadge` | `[NEW]` `components/dashboard/status-badge.tsx` | §1.2 map — replaces per-page inline badge logic |
| `Money` / `etb()` | `lib/client.ts` | `ETB 4,500` formatting, always integer-safe `[EXISTING]` |
| `Timeline` | inline in booking pages `[EXISTING]` | extract to shared component `[NEW]` |
| Evidence lightbox | inline `[EXISTING]` | before/during/after viewer `[EXISTING]` |
| `EmptyState`, `ErrorState`, `SkeletonList` | `[NEW]` | §1.3 kit — dedupe across pages |
| Upload picker | inline per page `[EXISTING]` | unify: type/size validation + progress `[NEW]` |
| Notification bell | `[PLANNED]` header widget | dropdown with unread, mark-all, role-correct links |
| Star rating input | reviews page `[EXISTING]` | extract for reuse `[NEW]` |

---

## 5. The three scoped features — UI acceptance

### 5.1 Universal job feed `[NEW]`
- Worker feed shows jobs from **all** homeowners (no hidden category/city filter); subtitle changes from *"matched to your categories and city"* → *"All open jobs from customers"*.
- Optional filters remain: category dropdown, "Emergency & urgent only" switch.
- Each card: title, category, urgency pill, budget, area (not exact address), posted-time, quotation count, action **View & accept**.
- Requests already quoted by others still appear (`status: quoted`) until booked/cancelled/expired.

### 5.2 Accept job `[NEW]`
- Primary button on job detail: **Accept job** (with price summary line: *Accept at 4,500 ETB*).
- Dialog: editable price (prefilled budget) → confirm → state card *"✓ Offer sent — waiting for the customer's confirmation"* (replaces buttons; **Send quotation** and **Message homeowner** remain available while pending).
- Customer side: the accepted offer appears at the top of the quotation list with an "Accepted the job" flag and one **Confirm & book** action → existing booking flow (phases, CBE instructions, chat) runs unchanged.

### 5.3 Pre-accept messaging `[NEW]`
- **Message homeowner** button beside Accept/Send quotation; opens `/dashboard/worker/messages/[id]` in the same tab.
- Thread is the booking-less (customer, worker) conversation; when a booking is later created, its own booking thread appears separately — UI must label threads: `Job: <title>` for booking threads vs `General` for booking-less ones (badge rule in `MessagesPage`).

---

## 6. Responsive & mobile rules (master spec §80)

| Surface | Mobile behaviour |
| --- | --- |
| Dashboard sidebar | collapses to drawer; floating primary action preserved (e.g. "New request", "Accept job") |
| Feed cards | single column, budget + urgency visible without scrolling |
| Quotation comparison | stacked cards (not a table) below `md`; accept button sticky at bottom |
| Booking detail | tab bar scrolls horizontally; payment phase rows become full-width cards |
| Proof upload | native camera/gallery picker (`accept="image/*"`), one-tap submit |
| Chat | fixed composer above safe-area; attachments via sheet |
| Admin tables | horizontal scroll with sticky first column; row detail opens bottom sheet |

---

## 7. Accessibility & UX checklist

- [ ] All inputs have `<Label>`; errors via `aria-describedby` + visible text
- [ ] Focus-visible rings on every interactive element; dialogs trap focus (Radix)
- [ ] Colour contrast ≥ 4.5:1 for badge text; never colour-only status
- [ ] Loading states never block the whole page (skeleton per region)
- [ ] Destructive actions double-confirm; toasts state what happened and next step
- [ ] Server errors never render raw JSON/stack to users (NFR-06/SEC-11)
- [ ] Empty states always offer the next action
- [ ] Money always `ETB` formatted, integer, with phase labels

---

## 8. Gap matrix (page-level)

| Area | Existing | To build (agreed scope) | Later |
| --- | --- | --- | --- |
| Public | 8 pages | — | about/contact/terms/privacy/service detail |
| Customer | 10 pages | accept-confirm affordance on request detail; notifications page | quotations, support, settings |
| Worker | 8 pages | universal feed copy/logic, Accept dialog, Message homeowner button | calendar, quotations, verification, availability |
| Admin | 8 pages | verification-center tabs (under verification/overdue), booking audit view | complaints, disputes, support, reports/exports, settings, roles, announcements |
| Shared | shell, chat, badges | `StatusBadge`, state kit, timeline component, notification bell | realtime chat, i18n |

**Build order:** feed (5.1) → accept (5.2) → messaging (5.3) → shared kit (§4) → planned pages (§3.4 last).


---

## 9. Theming & language (dark mode + EN / አማርኛ) `[NEW]`

### 9.1 Dark mode
- **Toggle:** ghost icon button (`components/theme-toggle.tsx`, lucide Sun/Moon, mounted-state guard to avoid hydration mismatch). Placement: site header action row + mobile menu (`components/site/nav.tsx`), dashboard sticky header next to the language switcher (`components/dashboard/shell.tsx`).
- **Mechanism:** `next-themes` (`attribute="class"`, `defaultTheme="light"`, `enableSystem`, `disableTransitionOnChange`) mounted in `app/layout.tsx`; Tailwind `darkMode: ["class"]`; palette in `app/globals.css` `:root` / `.dark`. Dark `--primary`/`--ring` are raised to `201 96% 45%` for contrast on near-black.
- **Color rules:** layout surfaces use semantic tokens (`bg-card`, `bg-muted`, `bg-background`, `text-muted-foreground`, `border-border`). Every tinted status color carries a `dark:` pair (e.g. `bg-amber-50 dark:bg-amber-950/60`, `text-red-600 dark:text-red-400`). Verified by grep gate: no `bg-white`/`bg-slate-*` surface without a token or `dark:` counterpart.
- **Documented exceptions (intentional white in both modes):** hero badge `bg-white/15` on the gradient hero (`app/page.tsx`) and the search submit button `bg-white` on the hero gradient (`components/site/search-hero.tsx`).

### 9.2 Language (English / አማርኛ)
- **Switcher:** globe dropdown (`components/locale-toggle.tsx`) beside the theme toggle in both headers; options *English* / *አማርኛ* with a check on the active one.
- **Persistence & runtime:** cookie `hh_locale` (max-age 1 year, read by the provider effect) + `<html lang>` kept in sync. Client components: `useLocale()` → `t("key", vars?)` from `context/locale.tsx`. The five SSR pages (`/`, `/faq`, `/how-it-works`, `/services`, `/workers/[id]`) use `getT()` from `i18n/server.ts` (they read the cookie server-side and render the right language on first paint — these routes are dynamic).
- **Dictionaries:** `i18n/{en,am}/{common,worker,customer,admin,public}.json` — flat dotted keys, 1 893 keys, prefix = owning slice. `npm run i18n-check` enforces: en/am key parity, non-empty values, identical `{placeholder}` tokens, and existence of every `t("…")` literal referenced in `app/**`, `components/**`, `context/**`.
- **Font:** Inter (latin) + Noto Sans Ethiopic (`next/font`); `[lang="am"]` switches `body`/form-control font-family to `--font-ethiopic`.
- **Out of scope (stays English):** `/api/**` responses and Zod/server error messages, notification titles/bodies stored in the DB, `metadata`, enum values sent back to the server, brand names (Local Handyman, CBE, ETB). Number/date output stays `en-ET` (`etb()`, `timeAgo()`) in both locales.
- **Known tradeoff:** locale is resolved client-side, so client components may show English for one frame on first paint for a returning Amharic user; SSR pages render Amharic immediately. Switching is instant afterwards and persists via cookie.
