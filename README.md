# Local Handyman

Ethiopia's skilled-worker service marketplace. Customers describe a job, receive quotations from verified workers, book one, and pay **manually via CBE** — the platform never touches money; payment proofs are verified by an admin.

Full-stack **Next.js 15 + MongoDB** — no FastAPI, no external auth provider, no payment gateway.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, full-stack API route handlers) |
| Language | TypeScript (strict) |
| Database | MongoDB + Mongoose |
| Auth | Custom JWT (`httpOnly` cookie) + bcryptjs |
| Styling | Tailwind CSS + shadcn/ui + lucide-react |
| Charts | recharts |
| Uploads | Local filesystem (`.data/uploads`), access-controlled via `/api/uploads/[id]` |

## Features

- **Auth & roles** — register/login for `customer`, `worker`, `admin`; password rules, login lockout (5 attempts / 15 min), role-guarded API + pages.
- **Customer flow** — post a service request (category, urgency, photos, location) → compare quotations side by side → accept → booking with work phases and payment phases.
- **Worker flow** — verified profile (documents reviewed by admin), job feed, quotation submission, job execution with phased evidence (before/during/after), portfolio, reviews.
- **Payments (manual CBE)** — admin-editable CBE account details; per-phase payment proofs (reference, amount, screenshot) with duplicate detection, underpay/overpay flags, manual verify/reject. The worker cannot start work until the advance phase is verified.
- **Messaging** — per-booking conversations with unread notifications.
- **Reviews** — star ratings after completion, admin moderation (hide/restore/remove).
- **Admin** — dashboard stats/charts, Payment Verification Center, worker verification queue, users, categories, CBE accounts, audit log.

## Getting started

### Prerequisites

- Node.js 18+
- MongoDB running locally (or any URI)

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

```env
MONGODB_URI=mongodb://127.0.0.1:27017/homehelpconnect
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_APP_NAME=Local Handyman
UPLOAD_DIR=.data/uploads
MAX_UPLOAD_MB=8
```

### 3. Start MongoDB

Any local mongod works, e.g.:

```bash
mongod --dbpath "./.data/db"
```

### 4. Seed demo data

```bash
npm run seed
```

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000

## Seed accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@homehelp.et` | `Admin123!` |
| Customer | `customer@homehelp.et` | `Customer123!` |
| Worker | `abebe@worker.et` | `Worker123!` |
| Worker | `selam@worker.et` | `Worker123!` |
| Worker | `dawit@worker.et` | `Worker123!` |
| Worker | `henok@worker.et` | `Worker123!` |
| Worker | `meron@worker.et` | `Worker123!` |

Seeding also creates 91 service categories and an active CBE payment account.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run seed` | Reset & seed the database (destructive) |
| `npm run smoke` | 39-check end-to-end API smoke test (needs dev server + seeded DB) |
| `npm run lint` | ESLint |

## Project structure

```
app/
  api/                 # REST route handlers (~40 endpoints)
    auth/              # register, login, logout, me, password
    requests/          # service requests + quotations
    bookings/          # bookings, status transitions, phases
    payments/          # payment phases, proofs, verification, accounts
    worker/            # worker profile, documents, portfolio
    admin/             # stats, users, workers, audit
    ...                # categories, workers, conversations, notifications, reviews, uploads
  dashboard/
    customer/          # requests, bookings, payments, messages, favorites, reviews, profile
    worker/            # job feed, jobs, payments, portfolio, profile, reviews, messages
    admin/             # verification center, users, bookings, categories, accounts, audit
  workers/[id]         # public worker profile
  find-workers/        # public worker search
components/            # site + dashboard UI, shadcn primitives in ui/
context/auth.tsx       # client auth provider + useRequireAuth
lib/
  auth.ts, http.ts     # JWT/session helpers, API envelope (handle/ok/fail)
  models/              # Mongoose schemas
  services/            # booking state machine, notifications, audit, files
scripts/
  seed.ts              # database seeder
  smoke.mjs            # end-to-end API smoke test
```

## Key conventions

- **API envelope** — every endpoint returns `{ ok: true, data }` or `{ ok: false, error }`; handlers are wrapped in `handle()` from `lib/http.ts` and guarded with `requireAuth([roles])`.
- **Two phase collections** — `JobPhase` (work progress) and `PaymentPhase` (CBE dues) are separate but linked per booking; payment-phase verification gates `WORK_STARTED`.
- **No money flows through the site** — customers transfer via CBE using the admin-configured account, then upload proof; an admin verifies it manually. Proofs shown in the UI are platform records, not bank receipts.

## License

MIT — see [LICENSE](LICENSE).
"# LocalHandyMan" 
