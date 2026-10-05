# Software Requirements Specification (SRS)

**Project:** Local Handyman — Ethiopia's Skilled-Worker Service Marketplace
**Version:** 1.0
**Date:** 2 October 2026
**Status:** Draft for approval (baseline for system model → data model → API → UI → implementation → testing)

**Status legend used in Section 8**

| Tag | Meaning |
| --- | --- |
| `[EXISTING]` | Requirement already implemented in the current codebase |
| `[NEW]` | Requirement agreed in the current scope, not yet implemented |
| `[PLANNED]` | Identified for a later release |

---

## 1. Introduction

### 1.1 Purpose
This document specifies the complete functional and non-functional requirements of Local Handyman, a two-sided marketplace that connects homeowners (customers) with verified skilled workers (service providers) in Ethiopia. It is the controlling document for all subsequent artifacts: use-case model, MongoDB data model, API specification, UI specification, implementation plan, and test plan.

### 1.2 Scope
The system covers: account registration and role management, worker verification, service request posting, a public job listing visible to all providers, price negotiation by chat, one-click job acceptance, quotations, bookings with work phases, manual CBE payment phases with proof verification, messaging, notifications, reviews, favourites, admin oversight, audit logging and reporting.

### 1.3 Definitions

| Term | Meaning |
| --- | --- |
| Customer / Homeowner | Registered user who posts service requests and pays for jobs |
| Worker / Service Provider | Registered user who offers skills, quotes and executes jobs |
| Admin | Platform operator with full privileges, including payment verification |
| Service Request | A homeowner's job posting (category, description, budget, location, urgency) |
| Quotation | A worker's priced offer against a service request |
| Acceptance | A worker's one-click agreement to take a job; customer must confirm |
| Booking | A confirmed job contract created from an accepted quotation |
| Work Phase (JobPhase) | A milestone of physical work (before/during/after evidence) |
| Payment Phase (PaymentPhase) | A scheduled amount due (advance / progress / final) |
| Payment Proof | Customer's uploaded record of an off-platform CBE transfer |
| CBE | Commercial Bank of Ethiopia — all payments happen outside the platform |
| Verification | Admin review of a payment proof → `VERIFIED` or `REJECTED` |

### 1.4 Reference architecture of this document
Requirements (this document) → Actors & permission matrix (§7, §8) → Use cases (§11) → Business rules (§10) → Data model (follow-up document) → API design (follow-up document) → UI design (§18 + follow-up) → Implementation → Testing (§9, §17 basis for the test plan).

---

## 2. Background

Local Handyman is delivered as a full-stack **Next.js 15 + MongoDB** application (no external auth provider, no payment gateway). Ethiopia's payment infrastructure makes card/gateway integration impractical for this market, so the platform deliberately never touches money: customers transfer manually via CBE and upload proof; an admin verifies it.

The current codebase implements the majority of the marketplace loop end-to-end (verified by a 39-check automated API smoke suite). This SRS consolidates that behaviour into a formal specification and adds the newly scoped features: a universal job listing for all providers, worker-side job acceptance with customer confirmation, and pre-acceptance price negotiation chat.

---

## 3. Problem Statement

1. Homeowners cannot easily find many verified skilled workers for a single job, and cannot compare offers in one place.
2. Workers lack a single, complete listing of available jobs across all homeowners; today's feed is restricted by category and city.
3. Price discovery is slow: workers can only signal interest by submitting a full quotation, with no channel to negotiate before committing.
4. Trust is low in informal labour markets — there is no verification of workers, no contract record, no phased evidence of work, and no auditable payment trail.
5. Payments are informal and unverifiable (cash/CBE transfers with no receipt trail), creating disputes.
6. There is no accountability layer (audit log, moderation, dispute handling) for either party.

---

## 4. General Objective

To build a trusted, auditable marketplace in which a homeowner can post a job, reach **all** verified providers, negotiate price, book one provider, and pay manually via CBE with admin-verified proof — while providers discover all available jobs, negotiate, accept, execute in phases, and get paid against verified milestones.

---

## 5. Specific Objectives

| # | Objective |
| --- | --- |
| SO-1 | Register, authenticate and authorise three base roles (customer, worker, admin) with server-side enforcement |
| SO-2 | Verify worker identity/credentials through an admin review queue |
| SO-3 | Let any homeowner publish a service request with photos, location, urgency and budget |
| SO-4 | Show **every open job from every homeowner** to **every** service provider |
| SO-5 | Let providers negotiate price in chat **before** committing |
| SO-6 | Let providers accept a job in one click, and homeowners confirm the provider |
| SO-7 | Support full quotations with itemised costs and staged payment plans |
| SO-8 | Turn an accepted offer into a booking with work phases and payment phases |
| SO-9 | Record manual CBE payments as proofs, verified or rejected by authorised staff |
| SO-10 | Gate work start on verified advance payment |
| SO-11 | Provide per-booking messaging, notifications, reviews and moderation |
| SO-12 | Provide admin dashboards, statistics and an immutable audit log |

---

## 6. Scope

### 6.1 In scope
- Public site (home, services, find workers, worker profile, how it works, FAQ, login, register).
- Customer dashboard: requests, quotations comparison, bookings, payments/proofs, messages, favourites, reviews, profile.
- Worker dashboard: universal job feed, job detail, accept/quote, my jobs, work phases, payment records, portfolio, messages, reviews, profile.
- Admin dashboard: stats/charts, payment verification centre, worker verification queue, users, categories, CBE accounts, bookings, audit log.
- Manual CBE payment lifecycle with duplicate/under/over-payment detection.
- Messaging, notifications, reviews with moderation.
- Local file storage for uploads (photos, documents, portfolio, payment screenshots).

### 6.2 Out of scope (v1)
- In-app money movement, cards, mobile-wallet gateways (telebirr/CBE Birr APIs).
- Automated worker identity verification (e.g. DB/Id-fayda API integration) — manual admin review only.
- Native mobile applications (responsive web only).
- Escrow, refunds automation, insurance, warranty enforcement.
- Multi-language localisation (Amharic/Afaan Oromo UI) — English only in v1; i18n hooks deferred.
- Real-time WebSockets (polling-based messaging in v1 — see NFR-11).

### 6.3 Assumptions
- Users have their own smartphones/computers and internet access.
- Payments are made by the customer directly to the platform's configured CBE account.
- MongoDB is single-instance; uploads are stored on the local filesystem (`.data/uploads`).

---

## 7. Users / Actors

| Actor | Description | Primary goals |
| --- | --- | --- |
| **A1 Customer (Homeowner)** | Posts jobs, compares offers, books, pays via CBE, tracks progress, reviews | Get a job done reliably at an agreed price |
| **A2 Worker (Service Provider)** | Verified professional who browses all jobs, negotiates, accepts/quotes, executes work | Find work, agree price, complete jobs, get paid |
| **A3 Admin** | Platform operator; owns verification, configuration, moderation, audit | Run and audit the marketplace safely |
| **A4 Payment Verifier** *(planned role)* | Staff restricted to the Payment Verification Centre | Verify/reject payment proofs only |
| **A5 Support Staff** *(planned role)* | Handles tickets, complaints and selected account issues | Resolve user issues; no payment or booking authority |
| **A6 Guest (unauthenticated)** | Browses public pages | Search workers, view profiles, register |

> The current schema supports `customer | worker | admin` only. A4/A5 are specified here and are `[PLANNED]` as role extensions (see FR-ADM-07/08).

### 7.1 Permission matrix

| Capability | Guest | Customer | Worker | Support | Pay Verifier | Admin |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Browse public pages / worker profiles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register / login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create service request | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View **all** open jobs (universal feed) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Chat with counterparty **before** booking | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Accept job (one-click) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Submit quotation | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Accept/reject quotation → create booking | ❌ | ✅ (own) | ❌ | ❌ | ❌ | ✅ |
| Drive booking status (work execution) | ❌ | ✅ (own) | ✅ (own) | ❌ | ❌ | ✅ |
| Create/edit work phases + evidence | ❌ | ❌ | ✅ (own) | ❌ | ❌ | ✅ |
| Create/edit payment phases | ❌ | ✅ (own) | ✅ (own) | ❌ | ❌ | ✅ |
| Upload payment proof | ❌ | ✅ (own) | ❌ | ❌ | ❌ | ✅ |
| Verify / reject payment proof | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Submit review | ❌ | ✅ (after job) | ✅ (after job) | ❌ | ❌ | ✅ |
| Moderate reviews | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Verify worker documents | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage users / categories / CBE accounts | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Raise complaint / dispute | ❌ | ✅ | ✅ | ➖ | ❌ | ✅ |

✅ allowed · ❌ denied · ➖ via support ticket *(planned)*

---

## 8. Functional Requirements

### 8.1 Authentication & accounts (FR-AUTH)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-AUTH-01 | The system shall allow a visitor to register as a **customer** (name, email, phone, password, region). | `[EXISTING]` |
| FR-AUTH-02 | The system shall allow a visitor to register as a **worker** (adds gender, profession, headline, experience, starting price, service area). | `[EXISTING]` |
| FR-AUTH-03 | The system shall authenticate users with email + password, issuing an `httpOnly` JWT session cookie. | `[EXISTING]` |
| FR-AUTH-04 | The system shall hash passwords with bcrypt (cost factor ≥ 10) and never store/return plaintext. | `[EXISTING]` |
| FR-AUTH-05 | The system shall lock an account for 15 minutes after 5 consecutive failed logins. | `[EXISTING]` |
| FR-AUTH-06 | The system shall allow a logged-in user to change their own password (current password required). | `[EXISTING]` |
| FR-AUTH-07 | The system shall allow a user to log out (clear the session cookie). | `[EXISTING]` |
| FR-AUTH-08 | The system shall expose the current session via `GET /api/auth/me`. | `[EXISTING]` |
| FR-AUTH-09 | The system shall reject registration with an email already in use. | `[EXISTING]` |
| FR-AUTH-10 | The system shall enforce password rules (min 8 chars, mixed case + digit). | `[EXISTING]` |

### 8.2 Roles & authorisation (FR-RBAC)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-RBAC-01 | Every API handler shall verify the session and role before acting (`requireAuth([roles])`). | `[EXISTING]` |
| FR-RBAC-02 | Every dashboard page shall redirect unauthorised users to `/login` or the correct home. | `[EXISTING]` |
| FR-RBAC-03 | Resource access shall be ownership-scoped: users only read/mutate their own documents unless admin. | `[EXISTING]` |
| FR-RBAC-04 | The system shall record every privileged mutation in an append-only audit log (actor, action, target, timestamp). | `[EXISTING]` |
| FR-RBAC-05 | The system shall support a **Payment Verifier** role limited to proof verification endpoints. | `[PLANNED]` |
| FR-RBAC-06 | The system shall support a **Support Staff** role limited to tickets/complaints and read-only user lookup. | `[PLANNED]` |

### 8.3 Worker verification (FR-WRK)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-WRK-01 | A worker shall maintain a profile: profession, headline, skills, experience, bio, service area, availability, rates. | `[EXISTING]` |
| FR-WRK-02 | A worker shall upload verification documents (ID, licence, certificate) as files. | `[EXISTING]` |
| FR-WRK-03 | New workers start with status `pending` and shall not quote or accept jobs until `approved`. | `[EXISTING]` |
| FR-WRK-04 | An admin shall approve, reject (with note) or request resubmission of a worker's documents. | `[EXISTING]` |
| FR-WRK-05 | The system shall notify the worker on every verification decision and show a status banner. | `[EXISTING]` |
| FR-WRK-06 | A worker shall publish a portfolio (images + captions) and set availability (`available/busy/away/offline`). | `[EXISTING]` |
| FR-WRK-07 | An `offline` worker shall be excluded from quotation/acceptance actions. | `[EXISTING]` |
| FR-WRK-08 | A worker shall have a public profile page showing rating, reviews, portfolio and verified badge. | `[EXISTING]` |

### 8.4 Service requests (FR-REQ)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-REQ-01 | A customer shall create a service request: category/subcategory, title, description, urgency, location, photos, preferred date/time, budget, materials, access/special instructions. | `[EXISTING]` |
| FR-REQ-02 | A request shall be created with status `open` and expire automatically after 7 days (`expired`). | `[EXISTING]` |
| FR-REQ-03 | On creation the system shall notify up to 50 approved workers (and invited/preferred workers first). | `[EXISTING]` |
| FR-REQ-04 | A customer shall view, edit, cancel or close their own requests. Cancel shall withdraw that request's pending quotations. | `[EXISTING]` |
| FR-REQ-05 | A customer's request list shall show status, quotation counts and booking linkage. | `[EXISTING]` |
| FR-REQ-06 | The system shall expose request status transitions: `open → quoted → booking_created`, plus `cancelled` and `expired`. | `[EXISTING]` |
| FR-REQ-07 | **Every service provider shall see every open job posted by every homeowner** — the feed shall not be restricted by the worker's own categories or service city; `category` and `emergency` remain *optional* filters. | `[NEW]` |
| FR-REQ-08 | A request that has already received quotations (`quoted`) shall remain visible and actionable to other providers until it is booked, cancelled or expired. | `[NEW]` |
| FR-REQ-09 | Any provider shall be able to open the detail page of any job that is `open` or `quoted` (or to which they were invited). | `[NEW]` |
| FR-REQ-10 | The request detail view for a worker shall expose three actions: **Accept job**, **Send quotation**, **Message homeowner**. | `[NEW]` |

### 8.5 Job acceptance & quotations (FR-QUOTE)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-QUOTE-01 | An approved, available worker shall submit one itemised quotation per request (labour, materials, transport, other, duration, dates, warranty, payment plan, notes). | `[EXISTING]` |
| FR-QUOTE-02 | The quotation total shall equal the sum of its cost components; a payment plan must total 100% (default 30/40/30). | `[EXISTING]` |
| FR-QUOTE-03 | A worker shall not quote their own request; only one non-withdrawn quotation per worker per request. | `[EXISTING]` |
| FR-QUOTE-04 | Submitting a quotation shall move the request `open → quoted` and notify the customer with the price and a link. | `[EXISTING]` |
| FR-QUOTE-05 | A customer shall view all quotations for their request side by side, sorted by total. | `[EXISTING]` |
| FR-QUOTE-06 | A customer shall **accept** one quotation (creating a booking) or **reject** / **request changes** on others, with an optional note; the worker is notified. | `[EXISTING]` |
| FR-QUOTE-07 | A worker shall **accept a job in one click**: the system creates a quotation automatically, priced at the homeowner's listed budget by default, or at a price negotiated in chat if the worker enters one. | `[NEW]` |
| FR-QUOTE-08 | Acceptance shall be a *request to book*: it creates a pending offer that only the customer can confirm; it never creates a booking by itself. | `[NEW]` |
| FR-QUOTE-09 | On acceptance the system shall notify the customer: *"\<worker\> accepted your job at \<amount\> ETB — review and confirm"*. | `[NEW]` |
| FR-QUOTE-10 | Acceptance shall be blocked for: unapproved profile, `offline` availability, own request, an existing non-withdrawn quotation, or a request that is booked/cancelled/expired. | `[NEW]` |
| FR-QUOTE-11 | When a customer confirms any offer, all other pending offers shall be auto-rejected with the note "Customer selected another worker" and their workers notified. | `[EXISTING]` |
| FR-QUOTE-12 | The provider UI shall show an "Accepted — waiting for customer confirmation" state until the customer decides. | `[NEW]` |

### 8.6 Booking (FR-BK)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-BK-01 | The system shall create a booking from the accepted offer with a unique code, agreed total, dates, warranty, timeline entry and both parties linked. | `[EXISTING]` |
| FR-BK-02 | Booking status shall follow the state machine in §14; illegal transitions shall return `409`. | `[EXISTING]` |
| FR-BK-03 | The system shall seed three work phases (Inspection & assessment / Main work / Testing & completion) and split the total into payment phases per the payment plan. | `[EXISTING]` |
| FR-BK-04 | The booking shall start in `ADVANCE_PAYMENT_DUE`, linking the first payment phase as due. | `[EXISTING]` |
| FR-BK-05 | Creating a booking shall auto-create the booking conversation between customer and worker. | `[EXISTING]` |
| FR-BK-06 | Participants (and admin) shall read a booking with its phases, payments, quotation, request, conversation and `allowedTransitions`. | `[EXISTING]` |
| FR-BK-07 | The worker and customer shall each be able to cancel or dispute a booking (reason required); admin may force any transition. | `[EXISTING]` |
| FR-BK-08 | The customer's confirmation of completion shall auto-advance the booking to `CLOSED`. | `[EXISTING]` |
| FR-BK-09 | Either party shall raise a dispute; a disputed booking shall block normal transitions until resolved. | `[EXISTING]` |

### 8.7 Work phases (FR-WP)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-WP-01 | The worker shall add, edit, start, hand-to-customer, complete and remove work phases on a booking. | `[EXISTING]` |
| FR-WP-02 | Each phase supports before/during/after evidence photos uploaded through the platform. | `[EXISTING]` |
| FR-WP-03 | Completing phases shall recompute booking progress percentage and write timeline entries. | `[EXISTING]` |
| FR-WP-04 | The worker shall **not** start work (`WORK_STARTED`) until the advance payment phase is `VERIFIED`. | `[EXISTING]` |
| FR-WP-05 | Phase transitions shall follow `JOB_PHASE_STATUSES` and be authorised to the booking's worker (or admin). | `[EXISTING]` |

### 8.8 CBE payments (FR-PAY) — see workflow §12

| ID | Requirement | Status |
| --- | --- | --- |
| FR-PAY-01 | The system shall store admin-configurable CBE account details (bank, branch, account name/number, instructions) with an active flag. | `[EXISTING]` |
| FR-PAY-02 | The platform shall never process money; it only records proofs of off-platform transfers. | `[EXISTING]` |
| FR-PAY-03 | A customer shall submit a payment proof per phase: reference, amount, screenshot upload, note. | `[EXISTING]` |
| FR-PAY-04 | The system shall flag duplicate references, underpayment and overpayment for verifier attention. | `[EXISTING]` |
| FR-PAY-05 | An authorised verifier shall verify or reject a proof; rejection requires a reason and the customer is notified. | `[EXISTING]` |
| FR-PAY-06 | Verifying a proof shall mark the phase `VERIFIED`, update booking payment summary and advance booking status (`PAYMENT_VERIFIED`, next phase `PAYMENT_DUE`). | `[EXISTING]` |
| FR-PAY-07 | A rejected proof shall be resubmittable; the phase returns to `REJECTED → PAYMENT_DUE`. | `[EXISTING]` |
| FR-PAY-08 | When all phases are verified the booking may proceed to completion; totals must reconcile (`required = verified + pending + remaining`). | `[EXISTING]` |
| FR-PAY-09 | Both parties shall see per-booking payment summaries and per-phase states. | `[EXISTING]` |
| FR-PAY-10 | The customer shall have a payment history across bookings with totals. | `[EXISTING]` |
| FR-PAY-11 | The admin Payment Verification Centre shall list pending proofs enriched with booking, customer, phase and duplicate hints, and support verify/reject inline. | `[EXISTING]` |

### 8.9 Messaging (FR-MSG)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-MSG-01 | The system shall maintain conversations between a customer and a worker, optionally bound to a booking. | `[EXISTING]` |
| FR-MSG-02 | Messages may be text, image, file or location; attachments ≤ 8 MB from an allow-listed MIME set. | `[EXISTING]` |
| FR-MSG-03 | Participants shall read, send, edit (≤4000 chars) and delete their own messages; unread counts and last-message preview shall be maintained. | `[EXISTING]` |
| FR-MSG-04 | A **customer** shall start a conversation with any worker (from profile page or booking). | `[EXISTING]` |
| FR-MSG-05 | A **worker shall be able to start a conversation with the homeowner of a job before any booking exists** (`POST /api/conversations { customerId }`). | `[NEW]` |
| FR-MSG-06 | The job detail page shall expose a **Message homeowner** button that opens this pre-acceptance thread. | `[NEW]` |
| FR-MSG-07 | Exactly one booking-less thread shall exist per (customer, worker) pair, plus one thread per booking. | `[EXISTING]` |
| FR-MSG-08 | New messages shall notify the recipient with a link that resolves for their role (`/dashboard/{role}/messages/{id}`). | `[NEW]` (link fix) |
| FR-MSG-09 | Conversation lists shall show counterpart, booking badge, preview, time and unread count, refreshing at least every 15 s. | `[EXISTING]` |
| FR-MSG-10 | An admin shall read any conversation (support/moderation). | `[EXISTING]` |
| FR-MSG-11 | Neither party shall be able to message before authentication; blocked conversations shall refuse sends. | `[EXISTING]` |

### 8.10 Notifications (FR-NOT)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-NOT-01 | The system shall create in-app notifications for: quotation received/accepted/rejected, job accepted (needs confirmation), booking created, status changes, payment proof submitted/verified/rejected, messages, verification decisions, reviews, reminders. | `[EXISTING]` |
| FR-NOT-02 | Users shall see an unread badge and a list with mark-as-read / mark-all-read. | `[EXISTING]` |
| FR-NOT-03 | Notification links shall point to a real page of the recipient's role. | `[NEW]` (fix) |

### 8.11 Reviews (FR-REV)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-REV-01 | After completion, the customer shall review the worker (overall + quality/communication/punctuality stars, comment); the worker may review the customer. | `[EXISTING]` |
| FR-REV-02 | One review per booking per direction; a booking cannot be reviewed twice. | `[EXISTING]` |
| FR-REV-03 | The system shall recompute worker rating aggregates and expose them on the public profile and search. | `[EXISTING]` |
| FR-REV-04 | An admin shall hide, restore or remove a review (moderation) — moderation events are audited. | `[EXISTING]` |
| FR-REV-05 | Users shall list their given/received reviews. | `[EXISTING]` |

### 8.12 Search & discovery (FR-DISC)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-DISC-01 | Guests shall search workers by keyword, category, city, rating and price, with pagination. | `[EXISTING]` |
| FR-DISC-02 | The public services directory shall list all categories (91 seeded) and link to search. | `[EXISTING]` |
| FR-DISC-03 | Customers shall favourite/unfavourite workers and view the list. | `[EXISTING]` |
| FR-DISC-04 | Workers shall browse the universal job feed with optional category/urgency filters and pagination. | `[NEW]` (universal feed) |

### 8.13 Admin (FR-ADM)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-ADM-01 | The admin dashboard shall show platform statistics and charts (bookings, revenue-verified, users, proof volumes). | `[EXISTING]` |
| FR-ADM-02 | The admin shall list/search users, inspect and act on accounts (including blocking). | `[EXISTING]` |
| FR-ADM-03 | The admin shall manage the worker verification queue. | `[EXISTING]` |
| FR-ADM-04 | The admin shall manage service categories (create/edit/archive). | `[EXISTING]` |
| FR-ADM-05 | The admin shall manage CBE payment accounts (create/edit/activate). | `[EXISTING]` |
| FR-ADM-06 | The admin shall inspect any booking and force status transitions where required. | `[EXISTING]` |
| FR-ADM-07 | The admin shall manage the audit log view (filter by actor/action/date). | `[EXISTING]` |
| FR-ADM-08 | The admin shall create/disable staff accounts with roles **Payment Verifier** and **Support Staff**. | `[PLANNED]` |
| FR-ADM-09 | The system shall produce reports: bookings per period, verified payments, worker performance, category demand. | `[PLANNED]` |
| FR-ADM-10 | The system shall handle complaints/support tickets with status workflow. | `[PLANNED]` |

### 8.14 Files (FR-FILE)

| ID | Requirement | Status |
| --- | --- | --- |
| FR-FILE-01 | Users shall upload images/documents (≤ 8 MB) stored under `.data/uploads`. | `[EXISTING]` |
| FR-FILE-02 | Files shall be served only through an access-controlled endpoint (`/api/uploads/[id]`), never by public path. | `[EXISTING]` |
| FR-FILE-03 | Uploads shall be validated by MIME allow-list and size; a user may only read files they are entitled to. | `[EXISTING]` |

---

## 9. Non-Functional Requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-01 | Performance | Public pages shall render (SSR/ISR) with TTFB < 1 s and dashboard data APIs < 500 ms at p95 on local hardware. |
| NFR-02 | Performance | The job feed shall paginate (default 10/page, max 50) and use indexed queries; no unbounded scans. |
| NFR-03 | Availability | The system shall be restartable without data loss; MongoDB journaling enabled. |
| NFR-04 | Scalability | All list endpoints shall support `page`/`limit` and filtering to bound response size. |
| NFR-05 | Usability | Every workflow shall be completable on a 360 px-wide viewport; touch targets ≥ 40 px. |
| NFR-06 | Usability | Destructive actions require confirmation; errors show actionable copy (never stack traces). |
| NFR-07 | Reliability | Money-related state changes (verification, phase transitions) are transactional-by-sequence and idempotent-guarded (no double verification). |
| NFR-08 | Reliability | The smoke suite (39 checks) shall pass before every release; build must compile with type-checking and linting enabled. |
| NFR-09 | Maintainability | TypeScript strict mode; all API handlers use the shared `handle()/ok()/fail()` envelope and zod/manual validation. |
| NFR-10 | Maintainability | Code passes ESLint (`next/core-web-vitals` + `next/typescript`) with 0 errors. |
| NFR-11 | Realtime | v1 uses polling (messages 6 s, conversation list 15 s); design shall not preclude WebSocket upgrade later. |
| NFR-12 | Portability | Runs on Node 18+ with a single MongoDB URI; configuration via `.env`. |
| NFR-13 | Compatibility | Supports the latest two versions of Chrome, Edge, Firefox and Safari. |
| NFR-14 | Backup | Documented procedure to dump `.data/db` and `.data/uploads` (manual, daily recommended). |

---

## 10. Business Rules

| ID | Rule |
| --- | --- |
| BR-01 | Only approved (`status = approved`) and non-offline workers may quote or accept jobs. |
| BR-02 | A worker may hold only one live (non-withdrawn) quotation per request. |
| BR-03 | A worker may never quote or accept their own request. |
| BR-04 | Quotations/acceptances are possible while a request is `open` **or** `quoted`; impossible once `booking_created`, `cancelled` or `expired`. |
| BR-05 | Request expiry is automatic 7 days after creation. |
| BR-06 | Accepting a job is *not* a booking — only the customer's confirmation creates a booking. |
| BR-07 | The accepted offer's price may differ from the listed budget when negotiated in chat; the customer sees the exact amount before confirming. |
| BR-08 | Confirming one offer automatically rejects all other pending offers on that request. |
| BR-09 | A booking always derives from exactly one quotation and one request. |
| BR-10 | Payment plans must sum to 100% of the agreed total; default split 30/40/30 (advance/progress/final). |
| BR-11 | Work may not start until the advance payment phase is verified by an authorised verifier. |
| BR-12 | A payment proof reference that matches an existing proof is flagged as a possible duplicate for manual review — never auto-verified. |
| BR-13 | Only one review per booking per direction; ratings are recomputed from non-hidden reviews only. |
| BR-14 | Every booking transition, verification, moderation and admin action is written to the audit log. |
| BR-15 | Conversation participants are exactly one customer and one worker (+ admins for moderation). |
| BR-16 | Proof verification is restricted to admin/verifier roles — never the uploader of the proof. |
| BR-17 | The platform never initiates, holds or refunds money; it only records and verifies. |

---

## 11. Use Cases

### 11.1 Use-case inventory

| UC | Name | Primary actor | Secondary | Status |
| --- | --- | --- | --- | --- |
| UC-01 | Register (customer) | Guest | System | `[EXISTING]` |
| UC-02 | Register (worker) | Guest | System | `[EXISTING]` |
| UC-03 | Login / Logout | Any user | System | `[EXISTING]` |
| UC-04 | Change password | User | System | `[EXISTING]` |
| UC-05 | Manage profile | Customer/Worker | System | `[EXISTING]` |
| UC-06 | Upload verification documents | Worker | System | `[EXISTING]` |
| UC-07 | Verify worker | Admin | Worker | `[EXISTING]` |
| UC-08 | Search workers | Guest/Customer | System | `[EXISTING]` |
| UC-09 | Favourite worker | Customer | System | `[EXISTING]` |
| UC-10 | Create service request | Customer | Workers (notify) | `[EXISTING]` |
| UC-11 | View/edit/cancel request | Customer | System | `[EXISTING]` |
| UC-12 | **Browse all open jobs** | Worker | System | `[NEW]` |
| UC-13 | **Accept job (one-click)** | Worker | Customer | `[NEW]` |
| UC-14 | Submit quotation | Worker | Customer | `[EXISTING]` |
| UC-15 | **Negotiate price in chat (pre-booking)** | Worker ↔ Customer | System | `[NEW]` |
| UC-16 | Compare quotations | Customer | System | `[EXISTING]` |
| UC-17 | Accept quotation → create booking | Customer | Worker | `[EXISTING]` |
| UC-18 | Reject / request changes on quotation | Customer | Worker | `[EXISTING]` |
| UC-19 | Confirm accepted job (customer) | Customer | Worker | `[NEW]` |
| UC-20 | Schedule / start job | Worker | Customer | `[EXISTING]` |
| UC-21 | Create / update work phase with evidence | Worker | Customer | `[EXISTING]` |
| UC-22 | Configure payment phases | Customer/Worker | System | `[EXISTING]` |
| UC-23 | Submit CBE payment proof | Customer | Verifier | `[EXISTING]` |
| UC-24 | Verify payment proof | Admin/Verifier | Customer, Worker | `[EXISTING]` |
| UC-25 | Reject payment proof | Admin/Verifier | Customer | `[EXISTING]` |
| UC-26 | Resubmit payment proof | Customer | Verifier | `[EXISTING]` |
| UC-27 | Send message / attach file | Customer/Worker | Other party | `[EXISTING]` |
| UC-28 | Complete job (worker) | Worker | Customer | `[EXISTING]` |
| UC-29 | Confirm completion (customer) | Customer | Worker | `[EXISTING]` |
| UC-30 | Submit review | Customer/Worker | Other party | `[EXISTING]` |
| UC-31 | Moderate review | Admin | Reviewer | `[EXISTING]` |
| UC-32 | Cancel booking | Customer/Worker/Admin | Other party | `[EXISTING]` |
| UC-33 | Raise dispute | Customer/Worker | Admin | `[EXISTING]` |
| UC-34 | Manage categories | Admin | System | `[EXISTING]` |
| UC-35 | Manage CBE accounts | Admin | System | `[EXISTING]` |
| UC-36 | View statistics & audit log | Admin | System | `[EXISTING]` |
| UC-37 | Manage users | Admin | Users | `[EXISTING]` |
| UC-38 | Raise complaint / support ticket | Customer/Worker | Support | `[PLANNED]` |
| UC-39 | Generate reports | Admin | System | `[PLANNED]` |
| UC-40 | Pay-verifier restricted login | Payment Verifier | System | `[PLANNED]` |

### 11.2 Detailed use cases (critical paths)

**UC-12 — Browse all open jobs (Worker)**
- *Preconditions:* Worker authenticated, profile `approved`.
- *Flow:* 1. Worker opens Job Requests → 2. System fetches `GET /api/requests?view=available` → 3. System returns **all** `open`/`quoted` requests from all customers (excluding the worker's own) → 4. Worker may filter by category or "emergency only" → 5. Worker opens a request detail.
- *Alternative:* pagination; empty state with CTA.

**UC-13 — Accept job (Worker)**
- *Preconditions:* Worker approved & available; request `open`/`quoted`; no live quotation of theirs; not their own request.
- *Flow:* 1. Worker opens request → 2. Presses **Accept job** → 3. Price field pre-filled with the homeowner's budget (editable — use the negotiated amount) → 4. `POST /api/requests/:id/accept` → 5. System creates a pending offer (quotation `source = accept`) → 6. Customer notified → 7. UI shows "Waiting for customer confirmation".
- *Exceptions:* 403 unapproved/offline · 409 already quoted/booking exists · 400 own request · 409 price required (no budget and none entered).

**UC-15 — Negotiate price before accepting (Worker ↔ Customer)**
- *Preconditions:* Request visible to worker; either party authenticated.
- *Flow:* 1. Worker presses **Message homeowner** on job detail → 2. System creates/reuses the booking-less conversation → 3. UI routes to `/dashboard/worker/messages/:id` → 4. Parties chat about price/scope → 5. Worker accepts at the agreed amount (UC-13) or submits a quotation (UC-14).

**UC-19 — Confirm accepted job (Customer)**
- *Flow:* 1. Customer opens request → 2. Sees the accepted offer with price → 3. Presses **Confirm & book** (same as accept-quotation) → 4. `createBookingFromQuotation` runs → 5. Other pending offers auto-rejected + notified → 6. Booking created (`ADVANCE_PAYMENT_DUE`), phases seeded, conversation opened → 7. Worker notified with booking link.

**UC-23 → UC-25 — CBE payment proof cycle** (see §12 for full diagram).

---

## 12. Payment / CBE Workflow (specification)

```text
Booking created ──► First payment phase = PAYMENT_DUE (ADVANCE_PAYMENT_DUE)
        │
        ▼
Customer sees admin-configured CBE account details
        │
        ▼
Customer transfers OFF-platform (CBE app / branch / agent)
        │
        ▼
Customer uploads proof: reference + amount + screenshot (+ note)
        │   └─ system flags: duplicate reference / underpay / overpay
        ▼
Phase = PROOF_SUBMITTED → UNDER_VERIFICATION; booking = PAYMENT_PROOF_SUBMITTED
        │
        ▼
Verifier (admin) reviews in Payment Verification Centre
   ├─ VERIFIED ──► phase VERIFIED, booking PAYMENT_VERIFIED,
   │               summary re-computed, next phase PAYMENT_DUE,
   │               advance verified ⇒ worker may start work (BR-11)
   └─ REJECTED ──► reason + customer notified,
                   phase REJECTED ⇒ customer RESUBMITS (loop)
        │
        ▼ (all phases VERIFIED)
Booking may proceed: SCHEDULED → … → COMPLETED → CUSTOMER_CONFIRMED → CLOSED
```

Invariants: totals reconcile; a proof is never auto-verified; every step is audited; the platform never moves money.

---

## 13. Messaging Workflow

```text
Pre-booking:  Worker on job detail ──► POST /api/conversations {customerId}
              Customer on worker profile ──► POST /api/conversations {workerId}
              → one booking-less thread per (customer, worker) pair

Booking:      createBookingFromQuotation ──► ensureConversation(customer, worker, bookingId)
              → one additional thread bound to the booking

Send:         text | image | file | location (≤ 8 MB)
              → lastMessage/At/Sender updated, unread counters bumped
              → recipient notified with role-correct link
Read:         GET messages marks others' read, zeroes unread
Admin:        may open any thread (support/moderation)
```

---

## 14. Booking Workflow (state machine)

```text
REQUESTED → QUOTATION_SENT → QUOTATION_ACCEPTED → BOOKING_CONFIRMED
  → ADVANCE_PAYMENT_DUE → PAYMENT_PROOF_SUBMITTED → PAYMENT_VERIFIED
  → SCHEDULED → WORKER_ON_THE_WAY → WORK_STARTED → IN_PROGRESS
  → AWAITING_CUSTOMER → READY_FOR_REVIEW → COMPLETED
  → CUSTOMER_CONFIRMED → CLOSED

Side states: CANCELLED · REJECTED · DISPUTED · EXPIRED   (terminal, except DISPUTED resolution)
```

Rules: worker-driven statuses vs customer-driven statuses are enforced (§7.1); `WORK_STARTED` requires a verified advance; cancellation/dispute require a reason; customer confirmation auto-closes; every change appends a timeline entry and a notification.

---

## 15. Work-Phase Workflow

```text
NOT_STARTED ──► IN_PROGRESS ──► AWAITING_CUSTOMER ──► COMPLETED
     │               │                                    │
     └───────────────┴──────────────► CANCELLED ◄──────────┘

Evidence: before.jpg ── during.jpg ── after.jpg per phase
Progress: completed phases / total phases → booking.progressPercent
Gating:   WORK_STARTED requires verified advance payment (BR-11)
```

---

## 16. Security Requirements

| ID | Requirement |
| --- | --- |
| SEC-01 | Passwords stored only as bcrypt hashes; never logged or returned. |
| SEC-02 | Sessions via `httpOnly`, `sameSite` JWT cookies; secret from environment, rotated per deployment. |
| SEC-03 | Every API enforces role + ownership; IDOR tested for each `[id]` route. |
| SEC-04 | Uploads validated (size, MIME), stored outside the web root, served via authorisation-checked route. |
| SEC-05 | All user input validated server-side; MongoDB queries never built from raw strings (no injection via `$`-prefixed keys). |
| SEC-06 | Regex-escaped user search strings (already applied to job search). |
| SEC-07 | Login rate limiting by lockout policy (5 attempts / 15 min). |
| SEC-08 | Audit log is append-only; no API to edit or delete entries. |
| SEC-09 | Payment verification requires a distinct privileged role and is never permitted for the proof's uploader. |
| SEC-10 | No secrets or payment credentials exposed to client bundles; `.env` excluded from version control. |
| SEC-11 | Error responses return safe messages only; no stack traces in production. |
| SEC-12 | Admin-only pages and endpoints return 401/403 rather than leaking existence of resources (404 for non-participants). |

---

## 17. System Limitations

1. No automated payment verification — throughput limited to manual reviewer capacity.
2. No real money movement, refunds, escrow or chargeback handling; disputes are manual.
3. Local filesystem uploads ⇒ single-server deployment; horizontal scaling requires object storage.
4. Single MongoDB instance; no geo-indexing (city matching is case-insensitive string equality).
5. Messaging is polling-based (6–15 s), not instant; no push notifications/email/SMS in v1.
6. Worker verification is manual document review; no government ID API integration.
7. English-only UI in v1; no offline mode; no native apps.
8. Booking creation is single-worker (no team/multi-worker jobs) and single-currency (ETB).
9. Notifications are in-app only — no email/SMS fallback if the user never opens the app.
10. Automated test coverage is API-level (smoke); no browser-level E2E or unit test suite yet.

---

## 18. Technology Stack (as implemented)

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, route handlers as full-stack API) |
| Language | TypeScript (strict), ESLint `next/core-web-vitals` + `next/typescript` |
| Database | MongoDB + Mongoose 9 |
| Auth | Custom JWT (`httpOnly` cookie) + bcryptjs, 7-day expiry |
| Styling | Tailwind CSS + shadcn/ui + lucide-react |
| Charts | recharts |
| Uploads | Local filesystem (`.data/uploads`) via `/api/uploads/[id]` |
| API envelope | `{ ok: true, data }` / `{ ok: false, error }` via `handle()/ok()/fail()` |
| Validation | Manual + typed bodies (zod available) |
| Testing | `scripts/smoke.mjs` (39 end-to-end API checks) + page crawl |
| Tooling | `tsx` (seeder), npm scripts: `dev`, `build`, `seed`, `smoke`, `lint` |
| Future (per reference stack) | Zod validation everywhere, Socket.IO realtime, object storage, Express only if API is split out |

---

## Appendix A — Delivery plan for the agreed `[NEW]` scope

| Phase | Deliverables | Acceptance |
| --- | --- | --- |
| **P1 — Universal job listing** | FR-REQ-07/08/09, FR-DISC-14: remove category/city default filters; include `quoted` status; relax quotation & detail guards; update feed copy | Every provider sees every homeowner's job; a second/third provider can still quote after the first |
| **P2 — Accept job** | FR-QUOTE-07…12: `POST /api/requests/:id/accept`, notification, worker "waiting" state, customer confirm UI | One-click accept → customer confirms → booking + phases + chat created |
| **P3 — Pre-accept chat** | FR-MSG-05/06: worker-initiated `POST /api/conversations {customerId}`; **Message homeowner** button | Provider and homeowner can negotiate before any booking exists |
| **P4 — Correctness fixes** | FR-NOT-03/08 role-correct links; booking thread uses `bookingId`; admin conversation requires both ids | No dead links; chats bind to the right thread |
| **P5 — Verification** | lint 0 errors, `tsc --noEmit`, `npm run build`, 39-check smoke + new accept/chat checks, page crawl | All green |

## Appendix B — Traceability

| Business objective | Requirements |
| --- | --- |
| Trust & safety | FR-WRK-*, FR-RBAC-*, SEC-*, BR-14 |
| Fair market access | FR-REQ-07/08/09, FR-DISC-14, BR-04 |
| Clear price agreement | FR-MSG-05/06, FR-QUOTE-07…12, BR-06/07 |
| Guaranteed payment trail | FR-PAY-*, §12, BR-10…13, BR-17 |
| Quality of execution | FR-BK-*, FR-WP-*, §14, §15 |
