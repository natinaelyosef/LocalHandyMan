# Test Plan & Traceability Matrix

**Project:** Local Handyman — v1.0 — 2 October 2026
**Companion to:** `docs/SRS.md` · `docs/DATA-MODEL-AND-API.md` · `docs/UI-SPEC.md`
**Automation:** `scripts/smoke.mjs` (39 API checks, `npm run smoke`) + page crawl + `npm run lint` / `tsc --noEmit` / `npm run build`

---

## 1. Strategy

| Level | What | Tool | When |
| --- | --- | --- | --- |
| L0 Static | types, lint, build | `tsc --noEmit`, `next lint`, `next build` | every change |
| L1 API integration | full workflows over HTTP against a seeded DB | `scripts/smoke.mjs` | every change |
| L2 Targeted API | new/changed endpoints (accept, conversations, guards) | extend smoke suite | with each feature |
| L3 Page smoke | all routes return 200 (no SSR crash) | route crawl script | every change |
| L4 RBAC/security | negative access tests (role escalation, IDOR, upload abuse) | smoke negative section + manual | every release |
| L5 Manual UX | mobile layout, dialogs, empty/loading/error states, copy | checklist §8 | before release |

### 1.1 Test case format
`TC-<area>-<nn>` · *Pre* (preconditions) · *Steps* · *Expected* · *Automation* (`smoke` = automated, `manual`).

### 1.2 Environment & fixtures
- Fresh DB: `npm run seed` → accounts `admin@homehelp.et / Admin123!`, `customer@homehelp.et / Customer123!`, `abebe@worker.et …` (5 workers), 91 categories, 1 active CBE account.
- Dev server `npm run dev` on `:3000` (or `SMOKE_BASE` override).
- Seed data is **development-only** and must never be treated as verified production payments (master spec §109).

---

## 2. L0/L3 gates (already green)

| ID | Check | Status |
| --- | --- | --- |
| TC-BASE-01 | `tsc --noEmit` → 0 errors | ✅ |
| TC-BASE-02 | `next lint` → 0 errors (13 `no-img-element` warnings accepted) | ✅ |
| TC-BASE-03 | `next build` with type-check + lint enabled → exit 0 | ✅ |
| TC-BASE-04 | 33 public/dashboard routes → HTTP 200 | ✅ |

---

## 3. L1 regression — existing 39 automated checks (`smoke.mjs`)

| Group | Checks (labels) | FR coverage |
| --- | --- | --- |
| Auth | customer login, admin login, worker login, RBAC negative (customer blocked from admin) | FR-AUTH-01…10, FR-RBAC-01 |
| Catalogue | categories seeded (91) | FR-DISC-02 |
| Requests | request created, worker sees request in feed | FR-REQ-01…04 |
| Quotations | quotation submitted (total 5500) | FR-QUOTE-01…04 |
| Booking | booking created, payment phases split, job phases created, CBE account attached, conversation created | FR-BK-01…05, FR-PAY-01 |
| Payments | proof submitted, duplicate flagged, pending queue, verify proof, phase verified, next phase due, summary updated, booking advanced, all phases verified | FR-PAY-03…08, BR-12 |
| Work | work-start gate, job phase completed, work started, job completed | FR-WP-01…05, BR-11 |
| Close-out | booking closed, review created | FR-BK-08, FR-REV-01/02 |
| Messaging | message sent, conversation listed | FR-MSG-01…03 |
| Notifications | customer has notifications | FR-NOT-01/02 |
| Search | search workers, emergency filter | FR-DISC-01 |
| Profile | public worker profile rating | FR-WRK-08 |
| Payments history | history totals reconcile (required = verified + remaining) | FR-PAY-08/10 |
| Admin | stats, audit log, user list, verification queue | FR-ADM-01…03/07 |

**Pass rate required: 39/39 (now green).**

---

## 4. L2 — tests for the agreed `[NEW]` scope (P1–P5)

### 4.1 Universal job feed (FR-REQ-07/08/09)

| ID | Steps | Expected | Auto |
| --- | --- | --- | --- |
| TC-FEED-01 | Login as `abebe` (category A, city X) → `GET /api/requests?view=available` | Returns **all** open requests from all customers, including categories/cities outside abebe's profile | smoke |
| TC-FEED-02 | Second worker quotes on request R (status `open → quoted`) | `abebe` still sees R in feed (`status: quoted`) | smoke |
| TC-FEED-03 | After booking created on R | R disappears from every worker feed (`booking_created`) | smoke |
| TC-FEED-04 | Cancelled/expired request | excluded from feed | smoke |
| TC-FEED-05 | Worker opens detail of a `quoted` request they did not quote | 200 + `myQuotation: null`; Accept/Send quotation enabled | smoke |
| TC-FEED-06 | `?category=` and `?emergency=1` filters still apply when passed | only matching subset returned | smoke |
| TC-FEED-07 | Own request (`customerId = me`) never returned | excluded | manual (a provider cannot create requests) |
| TC-FEED-08 | Feed card data | every item carries `quotationCount` (quotes so far) and the card shows it | smoke |

### 4.2 Accept job (FR-QUOTE-07…12, BR-06/07/08)

| ID | Steps | Expected | Auto |
| --- | --- | --- | --- |
| TC-ACC-01 | Approved worker `POST /api/requests/:id/accept` (no body, budget 4500) | 200; quotation created `total=4500`, `source:"accept"`, `paymentPlan=30/40/30`, status `pending`; request → `quoted` | smoke |
| TC-ACC-02 | Accept with `price: 6000` (negotiated) | `total=6000` | smoke |
| TC-ACC-03 | Request with `budget: 0` and no `price` | 400 "price required" | smoke |
| TC-ACC-04 | Notification to customer | title/body mentions worker + amount, link → customer request page | smoke |
| TC-ACC-05 | Customer `PATCH /api/quotations/:id {action:"accept"}` on the accept-offer | booking created (existing flow), other offers auto-rejected + notified | smoke |
| TC-ACC-06 | Worker with `pending` profile accepts | 403 | smoke |
| TC-ACC-07 | Worker with `availability: offline` accepts | 409 | smoke |
| TC-ACC-08 | Accept own request | 400 | smoke |
| TC-ACC-09 | Accept after already having a live quotation | 409 | smoke |
| TC-ACC-10 | Accept a `booking_created` request | 409 | smoke |
| TC-ACC-11 | Customer accepts offer #1 while offer #2 pending | #2 → `rejected`, worker #2 notified | smoke |
| TC-ACC-12 | UI: worker sees "waiting for customer confirmation" state; customer sees "Confirm & book" | manual |

### 4.3 Pre-acceptance messaging (FR-MSG-05/06)

| ID | Steps | Expected | Auto |
| --- | --- | --- | --- |
| TC-CHAT-01 | Worker `POST /api/conversations {customerId}` | 200; conversation `bookingId: null`, participants = pair | smoke |
| TC-CHAT-02 | Repeat the same call | returns the **same** thread (no duplicates) | smoke |
| TC-CHAT-03 | Worker sends a message in that thread | customer receives it + unread + notification **with role-correct link** `/dashboard/customer/messages/:id` | smoke |
| TC-CHAT-04 | Customer replies | worker sees reply in `/dashboard/worker/messages` | smoke |
| TC-CHAT-05 | Booking later created for the pair | a **separate** booking thread exists; booking-less thread unchanged | smoke |
| TC-CHAT-06 | Worker `POST {workerId: self}` (legacy) | still returns their latest conversation (backward compatible) | smoke |
| TC-CHAT-07 | Admin `POST` without both ids | 400 (no admin-as-customer thread) | smoke |
| TC-CHAT-08 | Unauthenticated send | 401 | smoke |

### 4.4 Correctness fixes

| ID | Steps | Expected | Auto |
| --- | --- | --- | --- |
| TC-FIX-01 | Trigger a message notification for worker & customer | link resolves to an existing route for that role | smoke |
| TC-FIX-02 | Customer booking page "Message" sends `bookingId` | chat tab and button target the same thread | manual |
| TC-FIX-03 | `npm run smoke` against default port | no `SMOKE_BASE` needed on `:3000` | smoke |

---

## 5. L4 — security & RBAC matrix tests

| ID | Case | Expected |
| --- | --- | --- |
| TC-SEC-01 | Customer → `/api/admin/stats` | 401/403 ✅ (automated) |
| TC-SEC-02 | Worker → `POST /api/payments/proofs/:id/verify` | 403 (not admin/verifier) |
| TC-SEC-03 | Customer A fetches Booking B (`/api/bookings/:id`) | 404/403, no data leak |
| TC-SEC-04 | Customer A posts a message into B's conversation | 403 |
| TC-SEC-05 | Customer A submits a proof on B's payment phase | 403 |
| TC-SEC-06 | Worker reads another worker's quotation on a request | not exposed (owner/admin only) |
| TC-SEC-07 | Upload a 9 MB file / `.exe` | 400 (size/MIME) |
| TC-SEC-08 | `GET /api/uploads/:id` for a payment screenshot as guest | 401/403 |
| TC-SEC-09 | 6 failed logins | lockout 15 min (423) |
| TC-SEC-10 | Body with `{"$gt": ""}` in email | no NoSQL injection, 400/401 |
| TC-SEC-11 | JWT tampered/absent | 401 everywhere |
| TC-SEC-12 | Worker calls `PATCH /api/quotations/:id` (customer-only) | 403 |
| TC-SEC-13 | Attempt `REJECTED → VERIFIED` on a proof without resubmission | rejected by state machine |
| TC-SEC-14 | Password/reset fields never returned by any endpoint | absent from responses |
| TC-SEC-15 | `.env`, `.data/uploads` not served statically | 404 |

Manual items map to master spec §90 (role escalation, XSS, rate limiting).

---

## 6. Workflow acceptance tests (master spec §91)

### 6.1 Customer journey — `TC-E2E-CUST`
register → login → search worker → open profile → favourite → create request (photos) → receive quotation → **compare** → accept quotation → booking appears → open payment phase → see CBE account + instructions → submit proof (screenshot, ref, amount) → status *under verification* → (admin verifies) → see phase VERIFIED → track work phases + evidence → worker completes → **Confirm completion** → submit review → review visible on worker profile.
*Expected:* every step persists; no dead buttons; totals reconcile.

### 6.2 Worker journey — `TC-E2E-WRK`
register → complete profile → upload documents → (admin approves → verified badge) → **see all open jobs** → open job → **Message homeowner & negotiate** → **Accept at agreed price** → customer confirms → booking active → add/complete work phases with before/during/after evidence → see payment-proof status → mark work completed → receive review → payment records show verified history (**no wallet/withdraw anywhere**).

### 6.3 Admin journey — `TC-E2E-ADM`
login → dashboard stats/charts → verify worker (approve/reject/resubmit + reason) → manage categories → manage CBE account → open verification center → inspect proof (flags) → verify with audit entry → reject another with reason → customer resubmits → verify → monitor booking → view audit log filtered → (planned) handle complaint → dispute → report export.

---

## 7. Non-functional tests

| ID | Area | Criterion |
| --- | --- | --- |
| TC-NFR-01 | Pagination | every list endpoint bounds `limit` ≤ 50; no unbounded response |
| TC-NFR-02 | Feed query | uses indexes; 1k+ requests seed → feed p95 < 500 ms |
| TC-NFR-03 | Mobile | all pages usable at 360 px; primary action reachable one-handed |
| TC-NFR-04 | States | loading/empty/error present on every data page (spot-check 10 pages) |
| TC-NFR-05 | Idempotency | double-click "verify"/"accept"/"confirm" → single state change |
| TC-NFR-06 | Backup | `mongodump` + `.data/uploads` copy restores to a working instance |
| TC-NFR-07 | Warnings | lint has 0 errors; build passes with lint+types enforced |
| TC-THEME-01 | Theme toggle | click flips `class="dark"` on `<html>`; choice persists across reload; system theme honored on first visit | manual |
| TC-THEME-02 | Dark surfaces | tinted badges/panels carry `dark:` pairs; grep gate finds no `bg-white`/`bg-slate-*` surface outside the two documented white-on-gradient exceptions | grep + manual |
| TC-THEME-03 | Dark contrast | `.dark` `--primary`/`--ring` at `201 96% 45%`; `text-primary` readable on dark background | manual |
| TC-I18N-01 | Dictionary gate | `npm run i18n-check` exits 0: en/am parity, non-empty values, matching `{placeholders}`, every `t("…")` key in source exists | script |
| TC-I18N-02 | Switching | globe → አማርኛ updates site nav/footer, all three dashboards and public pages; `<html lang>` flips; `hh_locale=am` cookie persists after reload | manual |
| TC-I18N-03 | SSR rendering | fetch `/`, `/faq`, `/how-it-works`, `/services`, `/workers/[id]` with `hh_locale=am` → Ethiopic text in the HTML; English without the cookie | script |
| TC-I18N-04 | API untouched | `npm run smoke` still 75/75 (asserts English API messages and notification links) | smoke |
| TC-I18N-05 | Ethiopic font | with `lang="am"`, body renders in Noto Sans Ethiopic; no tofu boxes | manual |

---

## 8. Manual UX checklist (release gate)

- [ ] Accept dialog price pre-filled from budget, editable, shows 30/40/30 plan
- [ ] "Waiting for customer confirmation" state replaces action buttons but keeps Message/Quotation
- [ ] Customer request page flags accepted-offer and offers one **Confirm & book**
- [ ] Feed subtitle no longer claims category/city matching; filters work
- [ ] Message-homeowner button lands in the right thread; threads labelled *Job:* vs *General*
- [ ] Payment phase UI matches master spec §93 wording (I HAVE PAID → UNDER VERIFICATION → ✓ / REJECTED + reason + RESUBMIT)
- [ ] Verification center tabs include Under verification / Overdue
- [ ] No wallet/withdraw strings anywhere in worker UI
- [ ] Notification clicks land on real pages for both roles
- [ ] Empty states on: feed, bookings, messages, favorites, reviews

---

## 9. Traceability (FR → tests)

| FR group | Tests |
| --- | --- |
| FR-AUTH / RBAC | smoke auth+RBAC, TC-SEC-01…15 |
| FR-WRK verification | smoke verification queue, §6.3 |
| FR-REQ (incl. 07–10 `[NEW]`) | TC-FEED-01…07 |
| FR-QUOTE (incl. 07–12 `[NEW]`) | TC-ACC-01…12 |
| FR-BK | smoke booking chain, §6.1 |
| FR-WP | smoke work-start gate + phases |
| FR-PAY | smoke proof/verify/reject/balance, §93 wording check |
| FR-MSG (incl. 05/06 `[NEW]`) | TC-CHAT-01…08, TC-FIX-01/02 |
| FR-NOT | smoke notifications + TC-FIX-01 |
| FR-REV | smoke review + moderation manual |
| FR-ADM | smoke admin group, §6.3 |
| `[PLANNED]` FR-RBAC-05/06, FR-ADM-08…10 | deferred with phases P6–P7 |

---

## 10. Exit criteria

The release is **done** when:
1. `npm run lint` → 0 errors, `tsc --noEmit` → 0 errors, `npm run build` → exit 0.
2. `npm run smoke` → **39/39 + all new TC-FEED/ACC/CHAT/FIX checks pass**.
3. Route crawl → all 200.
4. §5 security matrix has no open failures.
5. §6 E2E journeys pass manually with realistic data.
6. §8 UX checklist fully ticked.
7. No `[NEW]` requirement in `docs/SRS.md` remains without a test.
