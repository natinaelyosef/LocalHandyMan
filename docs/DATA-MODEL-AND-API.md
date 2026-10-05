# Data Model & API Specification

**Project:** Local Handyman
**Version:** 1.0 — 2 October 2026
**Companion to:** `docs/SRS.md` (requirements) and the Master Build Specification (scope).
**Status tags:** `[EXISTING]` implemented in code · `[NEW]` agreed scope not yet built · `[PLANNED]` later release

---

# PART I — DATA MODEL (MongoDB / Mongoose)

## 0. Conventions

| Rule | Detail |
| --- | --- |
| ID strategy | MongoDB `ObjectId`; public human codes only where useful (`Booking.code = "BK…"`, `ServiceRequest.reference = "SR…"`) |
| References | Always `Schema.Types.ObjectId` + `ref`; no denormalised blobs across aggregate boundaries |
| Timestamps | Every collection has `timestamps: true` (except `AuditLog`, which stores `createdAt` only) |
| Enums | Shared in `lib/constants.ts`; schemas and API must use the same enum arrays |
| Money | Integers in **ETB** (no floats for totals; splits rounded then adjusted to sum exactly) |
| Soft delete | Domain records are never hard-deleted when history matters (`AuditLog`, `PaymentProof`, `Booking`, `Message.deletedAt`, `Review.status`) |
| Access control | Files served only via `/api/uploads/[id]` with per-kind permission checks — no public static paths |
| Envelope | `{ ok: true, data }` / `{ ok: false, error }` — see Part II §0 |

### 0.1 Entity–Relationship overview

```text
User (role: customer | worker | admin)
 ├─1:1─ WorkerProfile ── embedded: documents[], portfolio[], schedule[]
 ├─1:N─ Address
 ├─1:N─ ServiceRequest ──1:N── Quotation ──1:1── Booking
 │            │                      │              ├─1:N─ JobPhase   (work evidence)
 │            │                      │              ├─1:N─ PaymentPhase ──1:N─ PaymentProof
 │            │                      │              ├─1:1─ Conversation (booking thread)
 │            │                      │              ├─1:N─ Review / Complaint / Dispute
 │            │                      │              └─ embedded timeline[]
 │            │                      └─ (NEW) QuotationRevision[]
 │            └─ mediaFileIds[] ── FileAsset
 ├─1:N─ Conversation (customerId ↔ workerId, bookingId nullable) ──1:N─ Message
 ├─1:N─ Notification
 ├─1:N─ Favorite (customerId → workerId)
 ├─1:N─ Review (given/received)
 └─1:N─ AuditLog (actorId)

ServiceCategory (self-referencing parent → subcategories)
PaymentAccount (admin-configured CBE details)
FileAsset (uploaderId, kind, entityId) → stored under .data/uploads
Setting / Announcement / Complaint / Dispute / SupportTicket / RecurringService  (NEW / PLANNED)
```

---

## 1. Users & identity `[EXISTING]`

### 1.1 `users`
Source: `lib/models/User.ts:22`

| Field | Type | Notes |
| --- | --- | --- |
| `role` | enum `customer\|worker\|admin` | indexed; planned: + `payment_verifier`, `support`, `dispute_staff` `[PLANNED]` |
| `name` | string | min 2 |
| `email` | string | **unique**, lowercase, indexed |
| `phone` | string | indexed |
| `passwordHash` | string | `select: false` |
| `gender` | enum `male\|female\|other\|""` | |
| `avatarFileId` | ObjectId → FileAsset | |
| `status` | enum `active\|disabled\|suspended` | indexed |
| `emailVerified` / `phoneVerified` | boolean | |
| `loginAttempts` / `lockedUntil` | number / Date | 5 attempts → 15 min lock |
| `lastLoginAt` | Date | |
| `preferredLanguage` | enum `en\|am\|om` | i18n hook |
| `failedPaymentProofs`, `cancelledBookings` | number | counters |
| `resetTokenHash`, `resetExpires` | string/Date, `select:false` | prepared for forgot-password `[PLANNED]` |
| **NEW** `permissions` | string[] | granular permissions when role system expands `[PLANNED]` |
| **NEW** `permissionsHash`? | — | no; permissions live in a `roles` map in code + `settings` doc |

Indexes: `{ email: unique }`, `{ phone: 1 }`, `{ role: 1, status: 1 }`.

### 1.2 `addresses`
Source: `lib/models/User.ts:4`

`userId*`, `label` (Home/Office/Shop/Rental/Other), `region`, `city`, `woreda`, `subCity`, `area`, `street`, `latitude`, `longitude`, `notes`, `isDefault`.
Index: `{ userId: 1 }`.

### 1.3 `workerprofiles` `[EXISTING]`
Source: `lib/models/Worker.ts:45`

| Group | Fields |
| --- | --- |
| Identity | `userId` (**unique**, indexed), `profession` (enum, indexed), `headline`, `bio`, `skills[]`, `yearsOfExperience`, `languages[]` |
| Pricing | `startingPrice`, `priceNote` |
| Categories | `categoryIds[]` → ServiceCategory (indexed) |
| Location | `serviceArea { region, city, woreda, radiusKm, latitude, longitude }` |
| Availability | `availability` enum (`available/busy/away/offline`), `emergencyAvailable` (bool, indexed), `schedule[] { day, open, close, closed }` |
| Verification | `status` enum `WORKER_STATUSES` (`pending/under_review/approved/rejected/suspended/inactive`), `statusNote`, `verifiedAt`, `verifiedBy`, `documents[] { type, title, fileId, status, reviewNote, reviewedAt }` |
| Portfolio | `portfolio[] { title, category, description, before/during/after fileId, completedAt, area, status }` |
| Stats | `responseTimeMinutes`, `stats { jobsCompleted, jobsCancelled, ratingSum, ratingCount }`, `featured`, `searchBoost` |

Indexes: `{ availability:1, "serviceArea.city":1, profession:1 }`, text index on `headline, bio, skills, profession`.
**NEW:** verification decision log (who/when/why per transition) `[NEW]` — see §9 `workerverificationlogs`.

---

## 2. Catalogue `[EXISTING]`

### 2.1 `servicecategories`
Source: `lib/models/Service.ts:3`

`name`, `slug` (**unique**), `description`, `icon`, `parent` → self (subcategories, unlimited depth), `active`, `order`, `tags[]`.
Indexes: `{ slug: unique }`, `{ parent: 1, active: 1, order: 1 }`.
Seed: 91 categories. Services-as-entities beyond categories/subcategories are `[PLANNED]`.

---

## 3. Requests & quotations `[EXISTING + NEW]`

### 3.1 `servicerequests`
Source: `lib/models/Request.ts:21`

| Field | Type |
| --- | --- |
| `reference` | string, **unique** |
| `customerId` | → User (indexed) |
| `categoryId` / `subCategoryId` | → ServiceCategory |
| `title`, `description` | required / ≤5000 |
| `urgency` | enum `normal\|urgent\|emergency` (indexed) |
| `location` | embedded LocationSnapshot `{addressId,label,region,city,woreda,subCity,area,street,lat,lng,instructions}` |
| `mediaFileIds[]` | → FileAsset |
| `measurements`, `requiredMaterials`, `accessInstructions`, `specialInstructions` | strings |
| `preferredDate`, `preferredTime`, `budget` | |
| `status` | enum `open, quoted, booking_created, cancelled, expired` |
| `bookingId` | → Booking (nullable) |
| `invitedWorkerIds[]`, `preferredWorkerId` | → User |
| `expiresAt` | Date (7 days, indexed) |
| `recurring { enabled, interval }` | `none/weekly/monthly/quarterly` |

Indexes: `{ customerId:1, createdAt:-1 }`, `{ status:1, createdAt:-1 }`, `{ categoryId:1, status:1 }`, text `title, description`.

**Scope change `[NEW]`:** worker feed query must return **all** `open` **and `quoted`** requests regardless of the worker's `categoryIds` / `serviceArea.city` (SRS FR-REQ-07/08).

### 3.2 `quotations`
Source: `lib/models/Request.ts:59`

`requestId*`, `workerId*`, `customerId*`, `laborCost*`, `materialsCost`, `transportCost`, `otherCost`, `total*`, `estimatedDuration`, `proposedStartDate`, `proposedEndDate`, `warrantyDays`, `paymentPlan[] {label, percent}`, `notes`, `status` (`pending/accepted/rejected/withdrawn/changes_requested`), `customerNote`, `respondedAt`, `bookingId`, `responseMinutes`.

**NEW field `[NEW]`:**

```ts
source: { type: String, enum: ["quotation", "accept"], default: "quotation" }
// "accept" ⇒ created by the one-click Accept action (FR-QUOTE-07)
```

Indexes: `{ requestId:1, status:1 }`, `{ workerId:1, requestId:1 }` (uniqueness enforced in service code for non-withdrawn), `{ customerId:1, status:1 }`.

### 3.3 `quotationrevisions` `[NEW]`
Needed by master spec §17 (revision history — never silently overwrite).

| Field | Type |
| --- | --- |
| `quotationId*` | → Quotation |
| `revision*` | number (1,2,3…) |
| `snapshot*` | Mixed (full quotation document at save time) |
| `changedBy*` | → User |
| `changeNote` | string |

Index: `{ quotationId:1, revision:-1 }`.

---

## 4. Booking & work `[EXISTING]`

### 4.1 `bookings`
Source: `lib/models/Booking.ts:18`

`code*` (unique `BK…`), `requestId*`, `quotationId*`, `customerId*`, `workerId*`, `workerProfileId`, `categoryId`, `title*`, `description`, `urgency`, `location` (snapshot), `status` (enum `BOOKING_STATUSES`, 21 states), `agreedTotal*`, `startDate`, `expectedCompletion`, `startedAt`, `completedAt`, `confirmedAt`, `closedAt`, `cancelledAt`, `cancellationReason`, `cancelledBy` (`customer|worker|admin`), `warrantyDays`, `warrantyEndsAt`, `progressPercent`, `conversationId`, `jobPhaseIds[]`, `paymentPhaseIds[]`, `timeline[] {at, actorId, actorRole, action, note, from, to}`, `reviewed`, `disputeOpen`, `customerConfirmed`, `paymentSummary {total, verified, pending, remaining}`.

Indexes: `{ customerId:1, createdAt:-1 }`, `{ workerId:1, status:1 }`, `{ status:1, createdAt:-1 }`, `{ code: unique }`.

**NEW fields `[NEW]`:** `cancellationReasonCode` (enum of standard reasons), `recurringScheduleId` → RecurringService, `emergency: Boolean` (denormalised from request for visible marking).

### 4.2 `jobphases`
Source: `lib/models/Booking.ts:62`

`bookingId*`, `order*`, `name*`, `description`, `amount`, `startDate`, `dueDate`, `status` (`NOT_STARTED/IN_PROGRESS/AWAITING_CUSTOMER/COMPLETED/CANCELLED`), `notes`, `paymentPhaseId`, `evidence { before[], during[], after[] }` (FileAsset ids), `startedAt`, `completedAt`, `percent`.

Indexes: `{ bookingId:1, order:1 }`.

---

## 5. Payments (manual CBE) `[EXISTING]`

> **Money never touches the platform.** These collections are *records of off-platform transfers* and their verification.

### 5.1 `paymentaccounts`
`bank` (default "Commercial Bank of Ethiopia"), `accountName*`, `accountNumber*`, `branch`, `instructions`, `active`, `order`. Admin CRUD. Index: `{ active:1, order:1 }`.

### 5.2 `paymentphases`
Source: `lib/models/Payment.ts:17`

`bookingId*`, `order*`, `label*`, `purpose`, `amount*`, `paidVerified`, `status` (`UNPAID, PAYMENT_DUE, PROOF_SUBMITTED, UNDER_VERIFICATION, VERIFIED, REJECTED, CANCELLED`), `dueDate`, `paidAt`, `paymentAccountId`, `jobPhaseId`, `activeProofId`, `rejectionReason`, `verifiedBy`, `verifiedAt`, `reminderCount`, `lastReminderAt`, `history[] {at, status, actorId, actorRole, note}`.

Indexes: `{ bookingId:1, order:1 }`, `{ status:1, dueDate:1 }`.

### 5.3 `paymentproofs`
Source: `lib/models/Payment.ts:53`

`reference*` (indexed — duplicate detection), `paymentPhaseId*`, `bookingId*`, `customerId*`, `amountPaid*`, `requiredAmount*`, `bank`, `senderName*`, `senderAccount`, `receiverAccount`, `paidAt*`, `note`, `screenshotFileId*` (FileAsset), `status` (`pending|verified|rejected`), `rejectionReason`, `reviewedBy`, `reviewedAt`, `duplicateFlag`, `underpaidBy`, `overpaidBy`, `history[]`.

Indexes: `{ reference:1 }` (lookup for duplicates), `{ status:1, createdAt:-1 }`, `{ bookingId:1, createdAt:-1 }`, `{ paymentPhaseId:1 }`.
Verification history stays **embedded** (never rewritten) — satisfies master spec §32/§97 without a separate collection.

---

## 6. Communication `[EXISTING + NEW]`

### 6.1 `conversations`
`participants[]` (2 users), `customerId*`, `workerId*`, `bookingId` (**nullable** — booking-less threads used for pre-acceptance chat), `lastMessage`, `lastMessageAt`, `lastSenderId`, `unread {userId: count}`, `blockedBy[]`.
Indexes: `{ participants:1, bookingId:1 }`, `{ customerId:1, lastMessageAt:-1 }`, `{ workerId:1, lastMessageAt:-1 }`.
**Invariant:** one booking-less thread per (customer, worker) pair + one thread per booking.

### 6.2 `messages`
`conversationId*`, `senderId*`, `type` (`text|image|file|location`), `text`, `fileId`, `location {lat,lng,label}`, `readBy[]`, `editedAt`, `deletedAt`.
Index: `{ conversationId:1, createdAt:-1 }`.
**NEW `[PLANNED]`:** `replyToId`, `video` support (type `video`), delivery/read receipts for realtime phase.

### 6.3 `notifications`
`userId*`, `type*`, `title*`, `body`, `link`, `category` (`booking|payment|message|review|worker|system`), `read`, `readAt`.
Indexes: `{ userId:1, createdAt:-1 }`, `{ userId:1, read:1 }`.
**Rule `[NEW]`:** `link` must resolve inside the recipient's role space (`/dashboard/{role}/…`).

---

## 7. Reviews, files, audit, favourites `[EXISTING]`

### 7.1 `reviews`
`bookingId` (**unique** — one review per booking), `workerId*`, `customerId*`, `overall*` (1–5), `quality`, `communication`, `punctuality`, `professionalism`, `text` (≤2000), `photoFileIds[]`, `status` (`visible|hidden|removed`), `workerReply`, `reported`, `reportReason`.
Indexes: `{ workerId:1, status:1 }`, `{ customerId:1 }`.
**NEW `[PLANNED]`:** `reportHistory[] {byId, reason, at, resolution}` for moderation records.

### 7.2 `fileassets`
`uploaderId*`, `kind*` enum (`avatar, worker_document, portfolio, request_media, work_evidence, payment_proof, message, review`), `originalName`, `storedName*`, `mime*`, `size*`, `entityId`.
Indexes: `{ uploaderId:1 }`, `{ entityId:1 }`, `{ kind:1 }`.
Physical file: `.data/uploads/<storedName>`; served only by `/api/uploads/[id]` after authorization (SEC-04).

### 7.3 `auditlogs`
`actorId`, `actorRole`, `actorName`, `action*`, `entity*`, `entityId*`, `summary`, `meta` (Mixed), `createdAt`.
Indexes: `{ createdAt:-1 }`, `{ action:1, createdAt:-1 }`, `{ actorId:1 }`. Append-only — no update/delete API.

### 7.4 `favorites`
`customerId*`, `workerId*`; unique compound `{ customerId:1, workerId:1 }`.

---

## 8. New collections (agreed scope)

### 8.1 `complaints` `[NEW]`

| Field | Type |
| --- | --- |
| `reference` | string, unique (`CM…`) |
| `bookingId` | → Booking (nullable for account-level) |
| `customerId` / `workerId` | → User |
| `against` | enum `worker\|customer\|platform` |
| `category` | enum (late arrival, no-show, poor quality, incomplete, wrong price, damage, misconduct, payment, unsafe, access, other) |
| `description` | string ≤3000 |
| `evidenceFileIds[]` | → FileAsset |
| `status` | enum `open, investigating, resolved, dismissed` |
| `resolution` | string |
| `handledBy` | → User (admin/support) |

Indexes: `{ status:1, createdAt:-1 }`, `{ bookingId:1 }`, `{ customerId:1 }`.
A complaint promoted to dispute creates a `disputes` record linked by `complaintId`.

### 8.2 `disputes` `[NEW]`

| Field | Type |
| --- | --- |
| `reference` | unique (`DS…`) |
| `bookingId*`, `complaintId?`, `openedBy*` | refs |
| `status` | enum `open, evidence_requested, under_review, resolved, closed` |
| `claim` | Mixed `{ statement, wantedOutcome }` |
| `counterStatement` | string |
| `evidence` | array `{ byId, fileId, note, at }` |
| `investigationNotes[]` | `{ byId, at, note }` |
| `resolution` | `{ decidedBy, outcome, note, at }` — outcome enum `refund_not_applicable, partial_credit, rework, warning, dismissed` |
| `partiesNotifiedAt` | Date |

Indexes: `{ bookingId:1 }`, `{ status:1, createdAt:-1 }`.
Sets `bookings.disputeOpen = true` while active; only admin/dispute staff transition.

### 8.3 `supporttickets` `[NEW]`

`reference*` (unique `TK…`), `createdBy*`, `role`, `category` (`account, booking, payment_proof, worker, customer, technical, complaint, other`), `subject*`, `status` (`open, in_progress, waiting_user, resolved, closed`), `priority` (`low|normal|high`), `assignedTo`, `lastReplyAt`, `closedAt`.
**Thread:** embedded `messages[] { authorId, body, attachmentFileIds[], createdAt, internal }` (internal = staff-only note) — avoids a second collection.
Indexes: `{ status:1, createdAt:-1 }`, `{ createdBy:1 }`, `{ assignedTo:1 }`.

### 8.4 `recurringplans` `[PLANNED]`

`customerId*`, `workerId?`, `requestTemplate` (category, title, description, location snapshot, media), `interval` (`weekly|biweekly|monthly|custom`), `dayOfWeek`/`dayOfMonth`, `time`, `active`, `nextOccurrenceAt`, `originBookingId`, `childRequestIds[]`.
Master spec §42: each occurrence traceable to the arrangement.

### 8.5 `settings` `[PLANNED]`

Single doc (or `key`-unique rows): `key*` (unique), `value` (Mixed), `updatedBy`, `updatedAt`.
Keys: `platform.name`, `platform.logoFileId`, `contact.*`, `booking.rules`, `cancellation.rules`, `verification.rules`, `files.maxMB`, `notification.templates`, `review.rules`.

### 8.6 `announcements` `[PLANNED]`
`title`, `body`, `audience` (`all|customer|worker`), `active`, `startsAt`, `endsAt`, `createdBy`.

### 8.7 `workerverificationlogs` `[NEW]`
`workerProfileId*`, `userId*`, `from`, `to`, `actorId*`, `reason`, `documentIds[]`.
Index `{ workerProfileId:1, at:-1 }`. Complements the embedded `statusNote` with a full history (master spec §8, §97).

### 8.8 Role/permission model `[PLANNED]`
Keep `users.role` as the primary key of authorization (simple, already enforced server-side). Add:

```ts
// lib/constants.ts
export const ROLES = ["customer","worker","admin","payment_verifier","support","dispute_staff"];
export const PERMISSIONS = {
  payment_verifier: ["view_proofs","verify_proofs"],
  support: ["view_users","manage_tickets"],
  dispute_staff: ["view_bookings","manage_disputes"],
  admin: ["*"],
};
```

`requireAuth(roles)` plus a new `requirePermission(perm)` guard; super-admin = `admin`.

---

## 9. Index inventory (create/ensure on boot)

| Collection | Index |
| --- | --- |
| users | `{email:unique}`, `{phone:1}`, `{role:1,status:1}` |
| addresses | `{userId:1}` |
| workerprofiles | `{userId:unique}`, compound availability/city/profession, text search, `{status:1}` |
| servicecategories | `{slug:unique}`, `{parent:1,active:1,order:1}` |
| servicerequests | `{reference:unique}`, `{customerId:1,createdAt:-1}`, `{status:1,createdAt:-1}`, `{categoryId:1,status:1}`, `{expiresAt:1}`, text |
| quotations | `{requestId:1,status:1}`, `{workerId:1,requestId:1}`, `{customerId:1,status:1}` |
| bookings | `{code:unique}`, `{customerId:1,createdAt:-1}`, `{workerId:1,status:1}`, `{status:1,createdAt:-1}` |
| jobphases | `{bookingId:1,order:1}` |
| paymentphases | `{bookingId:1,order:1}`, `{status:1,dueDate:1}` |
| paymentproofs | `{reference:1}`, `{status:1,createdAt:-1}`, `{bookingId:1,createdAt:-1}`, `{paymentPhaseId:1}` |
| conversations | `{participants:1,bookingId:1}`, `{customerId:1,lastMessageAt:-1}`, `{workerId:1,lastMessageAt:-1}` |
| messages | `{conversationId:1,createdAt:-1}` |
| notifications | `{userId:1,createdAt:-1}`, `{userId:1,read:1}` |
| reviews | `{bookingId:unique}`, `{workerId:1,status:1}` |
| favorites | `{customerId:1,workerId:1:unique}` |
| auditlogs | `{createdAt:-1}`, `{action:1,createdAt:-1}`, `{actorId:1}` |
| fileassets | `{uploaderId:1}`, `{entityId:1}`, `{kind:1}` |
| complaints/disputes/supporttickets | as in §8 |

---

## 10. State machines (backend-validated)

| Entity | States | Notes |
| --- | --- | --- |
| ServiceRequest | `open → quoted → booking_created` / `cancelled` / `expired` | `[NEW]` quotation & accept allowed in `open` **or** `quoted` |
| Quotation | `pending → accepted \| rejected \| changes_requested \| withdrawn` | only customer transitions to accepted/rejected |
| Booking | `REQUESTED → QUOTATION_SENT → QUOTATION_ACCEPTED → BOOKING_CONFIRMED → ADVANCE_PAYMENT_DUE → PAYMENT_PROOF_SUBMITTED → PAYMENT_VERIFIED → SCHEDULED → WORKER_ON_THE_WAY → WORK_STARTED → IN_PROGRESS → AWAITING_CUSTOMER → READY_FOR_REVIEW → COMPLETED → CUSTOMER_CONFIRMED → CLOSED` (+ `CANCELLED/REJECTED/DISPUTED/EXPIRED`) | transition table in `lib/services/booking.ts:19`; illegal → `409` |
| JobPhase | `NOT_STARTED → IN_PROGRESS → AWAITING_CUSTOMER → COMPLETED` / `CANCELLED` | |
| PaymentPhase | `UNPAID → PAYMENT_DUE → PROOF_SUBMITTED → UNDER_VERIFICATION → VERIFIED \| REJECTED → (resubmit) …` | `WORK_STARTED` requires first phase `VERIFIED` |
| PaymentProof | `pending → verified \| rejected` | reject requires reason; resubmit creates a **new** proof (old kept) |
| WorkerProfile.status | `pending → under_review → approved \| rejected → (resubmit) under_review` | + `suspended`, `inactive` |
| Complaint | `open → investigating → resolved \| dismissed` | |
| Dispute | `open → evidence_requested → under_review → resolved → closed` | |
| SupportTicket | `open → in_progress → waiting_user → resolved → closed` | |

No state change is allowed without a matching transition entry; each writes an `AuditLog` row and a `Notification`.

---

# PART II — API SPECIFICATION

## 0. Envelope, errors, conventions `[EXISTING]`

```jsonc
// success
{ "ok": true, "data": { /* resource or list */ } }

// error
{ "ok": false, "error": "Human-readable message" }
```

Implemented by `handle() / ok() / fail()` in `lib/http.ts`; the client (`lib/client.ts`) unwraps `data` and throws `ClientApiError`.

> **Decision (divergence from Master Spec §104):** the master spec suggests `{ success, message, errors }`. The codebase's `{ ok, data }` envelope is used by all 42 existing routes and the client. **Keep `{ ok, data }` as canonical** (spec says *preserve working architecture*); if a compatibility layer is ever required, add `success`/`message` aliases in `lib/http.ts` rather than rewriting 42 routes.

| Convention | Rule |
| --- | --- |
| Auth | `httpOnly` JWT cookie; every handler starts with `requireAuth([roles])` |
| Params | Dynamic segments are `Promise<{ id: string }>` (Next 15); validate with `requireValidId(id)` |
| Validation | Body parsed via `readJson<T>()`; manual guards + optional zod schemas `[PLANNED: zod everywhere]` |
| Pagination | `?page=1&limit=15` (max 50); responses `{ items, total, page, limit, pages }` |
| Idempotency | Verification/transition endpoints guard against double application |
| File upload | `POST /api/uploads` (multipart) → `{ fileId }`; download `GET /api/uploads/[id]` |

---

## 1. Authentication `[EXISTING]`

| Method | Path | Auth | Body → Data |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | `{role,name,email,phone,password,…}` → `{user, token cookie}` |
| POST | `/api/auth/login` | public | `{email,password}` → `{user}` (lockout 5/15) |
| POST | `/api/auth/logout` | any | clears cookie |
| GET | `/api/auth/me` | any | → `{user}` or 401 |
| POST | `/api/auth/password` | any | `{current,next}` → change password |
| PATCH | `/api/auth/password` | any | forgot/reset flow using `resetTokenHash` `[PLANNED]` |
| POST | `/api/auth/refresh` | any | token rotation `[PLANNED]` |

---

## 2. Profile & addresses `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET/PATCH | `/api/profile` | any | own profile (name, phone, gender, avatar, language) |
| GET/POST | `/api/addresses` | any | list/create own addresses |
| PATCH/DELETE | `/api/addresses` | any | by id, ownership-checked |

---

## 3. Worker endpoints `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/worker/profile` | worker | own profile incl. documents/portfolio/stats |
| PATCH | `/api/worker/profile` | worker | update profile, availability, schedule, resubmit `{resubmit:true}` |
| POST/DELETE | `/api/worker/documents` | worker | upload/remove verification documents |
| POST/DELETE | `/api/worker/portfolio` | worker | manage portfolio items |
| GET | `/api/workers` | public | search: `q, category, city, rating, emergency, page, limit` |
| GET | `/api/workers/[id]` | public | public profile (no private docs) |

---

## 4. Categories `[EXISTING]` + services `[PLANNED]`

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/categories` | public (tree) |
| POST | `/api/categories` | admin |
| GET/POST/PATCH/DELETE | `/api/categories/[id]` | admin |

---

## 5. Service requests `[EXISTING + NEW]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/requests` | any | role branch: `customer` → own; **`worker` + `view=available` → ALL open/quoted jobs from every homeowner** `[CHANGED]`; `admin` → all |
| POST | `/api/requests` | customer | creates `open` request, notifies ≤50 approved workers |
| GET | `/api/requests/[id]` | any | owner/admin: quotations sorted by total; **worker: allowed when `open`/`quoted` or invited** `[CHANGED]` + `myQuotation` + `profile` |
| PATCH | `/api/requests/[id]` | customer/admin | `action: "cancel" \| "close"` |
| POST | `/api/requests/[id]/quotations` | worker | submit quotation; guards: `open` **or** `[NEW] quoted`, not own, one live quote, approved, not offline, `laborCost>0`, plan=100% |
| **POST** | **`/api/requests/[id]/accept`** | **worker** | **`[NEW]` one-click Accept (FR-QUOTE-07…10)** |

### 5.1 `POST /api/requests/[id]/accept` `[NEW]`

```jsonc
// request
{ "price": 4500,            // optional if request.budget > 0; ETB
  "note": "Agreed on chat"  // optional
}
// 200 →
{ "ok": true, "data": { "quotation": {...}, "status": "pending_customer" } }
```

| Error | When |
| --- | --- |
| 401 | not authenticated |
| 403 | role ≠ worker, profile not `approved`, availability `offline` |
| 404 | request not found / not visible |
| 400 | own request, or price missing with no budget |
| 409 | request not `open`/`quoted`, or worker already has a live quotation |

Side effects: create `Quotation { source: "accept", paymentPlan: default 30/40/30 }`, request `open → quoted`, notify customer *“\<worker\> accepted your job at X ETB — review and confirm”*, audit `quotation_accepted_intent`.

---

## 6. Quotations `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| PATCH | `/api/quotations/[id]` | customer | `action: accept \| reject \| request_changes`; `accept` → `createBookingFromQuotation()` |
| GET | `/api/quotations/[id]` | participant | detail `[PLANNED]` |
| GET | `/api/quotations?mine=worker` | worker | own quotations + statuses `[PLANNED]` |
| GET | `/api/quotations/[id]/revisions` | participant | `[NEW]` revision history |

---

## 7. Bookings `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/bookings` | any | scoped: worker → own jobs, customer → own, admin → all; `status,q,page,limit` + `statusCounts` |
| GET | `/api/bookings/[id]` | participant/admin | booking + `allowedTransitions`, phases, payments, quotation, request, conversation, accounts, viewer |
| POST | `/api/bookings/[id]/status` | participant/admin | transition; `WORK_STARTED` blocked until advance verified; `CANCELLED/DISPUTED` need `reason` |
| POST | `/api/bookings/[id]/payment-phases` | worker/admin | configure split (100%) |
| GET/POST | `/api/bookings/[id]/review` | customer | read/create review |
| POST | `/api/bookings/[id]/cancel` | participant | `[PLANNED]` reason codes |
| POST | `/api/bookings/[id]/rebook` | customer | "Book this worker again" `[PLANNED]` |

---

## 8. Work phases `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/job-phases/[id]` | worker/admin | create phase on booking (`[id]` = booking id) |
| PATCH | `/api/job-phases/[id]` | worker/admin | edit / start / hand over / complete / remove evidence / progress |
| POST | `/api/job-phases/review` | customer/admin | customer phase sign-off |

Evidence upload: `POST /api/uploads` (`kind=work_evidence`) → `PATCH /api/job-phases/[id] { evidence: {before|during|after: [fileId] } }`.

---

## 9. Payments `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/payment-accounts` | public/any | active CBE accounts + instructions |
| POST/PATCH/DELETE | `/api/payment-accounts` | admin | configure CBE details |
| GET | `/api/payments/history` | any | own history with totals `{required, verified, pending, remaining}` |
| GET | `/api/payments/phases/[id]/proof` | customer/admin | phase detail + proof + CBE instructions |
| POST | `/api/payments/phases/[id]/proof` | customer | submit proof: `{reference, amountPaid, senderName, paidAt, screenshotFileId, note}` → duplicate/under/over flags |
| POST | `/api/payments/proofs` | customer | resubmit path (creates new proof for rejected phase) `[EXISTING via phase route]` |
| GET | `/api/payments/proofs` | admin | verification queue: `status, bookingId, page` |
| GET | `/api/payments/proofs/[id]` | admin | enriched proof detail |
| POST | `/api/payments/proofs/[id]` | admin | `{action:"verify" \| "reject", reason?}` → phase + booking advance + notify + audit |
| GET | `/api/admin/payments/export` | admin | CSV/Excel export of payment records `[PLANNED]` |

---

## 10. Messaging `[EXISTING + NEW]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/conversations` | any | scoped list, populated, `unreadCount`, `otherUser` |
| POST | `/api/conversations` | customer | `{workerId, bookingId?}` → thread |
| **POST** | **`/api/conversations`** | **worker** | **`[NEW]` `{customerId}` → create/reuse booking-less thread (currently 404s)** |
| GET | `/api/conversations/[id]/messages` | participant/admin | `?before&limit≤100`, marks read |
| POST | `/api/conversations/[id]/messages` | participant/admin | JSON `{text\|location}` or multipart `{text,file}`; updates last message + unread + notification with **role-correct link** `[FIX]` |
| PATCH | `/api/conversations/[id]/messages` | sender | `{messageId, action: edit\|delete, text?}` |

**`POST /api/conversations` contract after change:**

```jsonc
// customer → { workerId, bookingId? }
// worker   → { customerId }              // NEW
// admin    → { customerId, workerId }    // FIX: both required
```

---

## 11. Notifications `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/notifications` | any | `?unread=1`, paging |
| POST | `/api/notifications` | any | `{id?}` mark read / `{all:true}` mark all `[actions in body]` |
| POST | `/api/notifications/delete` | any | `[PLANNED]` |

Realtime delivery (Socket.IO) `[PLANNED]` — endpoint shape must stay the same.

---

## 12. Reviews & favourites `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/reviews` | any | `?workerId / ?bookingId / ?mine` |
| POST | `/api/reviews` | customer/worker | create (booking-scoped, unique) |
| PATCH | `/api/reviews` | admin | `hide \| restore \| remove` moderation |
| GET/POST | `/api/favorites` | customer | list / toggle |
| DELETE | `/api/favorites` | customer | remove |

---

## 13. Uploads `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/uploads` | any | multipart `file` + optional `kind` → `{ fileId }`; ≤8 MB, MIME allow-list |
| GET | `/api/uploads/[id]` | any | **permission-checked** stream (payment proofs/identity docs only for entitled roles) |
| DELETE | `/api/uploads/[id]` | owner/admin | `[PLANNED]` |

---

## 14. Admin `[EXISTING]`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/stats` | admin | dashboard stats + chart series |
| GET/PATCH/DELETE | `/api/admin/users` | admin | search/filter, status changes, role guard |
| GET | `/api/admin/workers` | admin | verification queue (`status`, `q`, paging) |
| POST | `/api/admin/workers/[id]/verify` | admin | `{action: approve\|reject\|resubmit, note}` → status + notify + audit + **verification log** `[NEW]` |
| GET | `/api/admin/audit` | admin | filtered audit log |

### 14.1 Planned admin endpoints `[PLANNED]`

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/complaints` · `/api/complaints/[id]` | file/handle complaints |
| GET/PATCH | `/api/disputes` · `/api/disputes/[id]` | dispute investigation + resolution |
| GET/POST/PATCH | `/api/support` · `/api/support/[id]` | tickets, replies, status |
| GET | `/api/reports?range&group` | bookings, users, payments, categories, locations |
| GET | `/api/reports/export?type=csv\|xlsx` | export reports |
| GET/POST/PATCH | `/api/settings` | platform settings |
| GET/POST/PATCH | `/api/announcements` | announcements |
| GET | `/api/roles` | role/permission matrix (read-only from code) |
| GET | `/api/notifications/admin` | platform alerts queue |
| POST | `/api/auth/forgot` · `/api/auth/reset` | password recovery (fields already exist) |

---

## 15. Page routes ↔ API map

| Area | Pages (existing) | Key API dependencies |
| --- | --- | --- |
| Public | `/`, `/services`, `/find-workers`, `/workers/[id]`, `/how-it-works`, `/faq`, `/login`, `/register` | `categories`, `workers`, `reviews` |
| Customer | `dashboard/customer/{,requests,requests/new,requests/[id],bookings,bookings/[id],payments,messages,favorites,reviews,profile}` | `requests`, `quotations`, `bookings`, `payments/*`, `conversations`, `favorites`, `reviews` |
| Worker | `dashboard/worker/{,requests,requests/[id],jobs,jobs/[id],payments,portfolio,profile,reviews,messages}` | `requests?view=available`, **`requests/[id]/accept` `[NEW]`**, `quotations`, `bookings`, `job-phases`, `conversations` |
| Admin | `dashboard/admin/{,payments,workers,users,bookings,categories,payment-accounts,audit}` | `admin/*`, `payments/proofs` |

Planned pages (master spec §77): `/dashboard/customer/{quotations,notifications,support,settings}`, `/dashboard/worker/{calendar,verification,quotations,support,settings}`, `/dashboard/admin/{complaints,disputes,support,reports,announcements,settings,roles}` — each maps 1:1 to the §14.1 endpoints.

---

## 16. Delivery order for this contract

| Phase | Contract items | Depends on |
| --- | --- | --- |
| P1 | Feed/visibility changes (§5) + guards | — |
| P2 | `POST /api/requests/[id]/accept` + `Quotation.source` (§3.2, §5.1) | P1 |
| P3 | Worker-initiated `POST /api/conversations` (§10) | — |
| P4 | Notification link fix + booking-thread fix (§6.3, §10) | — |
| P5 | Tests: lint, tsc, build, smoke (39) + new accept/chat assertions | P1–P4 |
| P6 | `complaints`, `disputes`, `supporttickets` + endpoints (§8, §14.1) | P5 |
| P7 | `settings`, `announcements`, reports/exports, roles expansion | P6 |
| P8 | Realtime (Socket.IO), i18n, recurring plans, refresh tokens | P7 |

**Definition of done for the contract:** every `[EXISTING]` endpoint still passes the 39-check smoke suite; every `[NEW]` endpoint has a passing API test; no endpoint returns data to an unauthorised role (verify with the RBAC negative cases in `scripts/smoke.mjs`).
