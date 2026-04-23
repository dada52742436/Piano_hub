# PianoHub

Portfolio-quality full-stack marketplace project for second-hand pianos in Melbourne.

## Overview

PianoHub is built to feel more like a real evolving product than a CRUD demo.  
It covers authentication, listing management, bookings, saved listings, inquiries, transactions, a full Stripe Checkout payment flow with webhook confirmation and seller-initiated refunds, listing images, and ownership-based access control.

## Features

### Public marketplace

- Browse active listings without an account
- Search by keyword
- Filter by brand, condition, and price range
- Sync search, filter, and pagination state to the URL
- Paginated listing results
- Listing detail pages

### Seller workflows

- Create, edit, and delete listings
- Manage listing status with `active`, `sold`, and `archived`
- Upload and delete listing images
- Review booking requests per listing
- Review buyer inquiries per listing
- Review transaction requests per listing
- Review payment status per transaction
- Complete a transaction once the buyer has paid via Stripe or simulated payment
- Issue a Stripe refund when cancelling a paid transaction (buyer's funds are returned automatically)

### Buyer workflows

- Register and log in
- Send booking requests
- Track booking status
- Save listings for later
- Send lightweight inquiries to sellers
- Track and close personal inquiries
- Start transactions on active listings
- Track personal transaction status and deal progression
- Pay for accepted transactions via Stripe Checkout (real card payment)
- Resume a pending Stripe Checkout session or cancel an expired one
- Use a simulated payment flow for local development and testing
- Review all payment attempts from a dedicated `My Payments` page

### Payment flow

- Stripe Checkout Session created on the backend, buyer redirected to Stripe-hosted payment page
- Stripe webhook confirms payment server-side (`checkout.session.completed`)
- Payment status flows: `pending` → `paid` → `refunded` (or `failed` / `cancelled`)
- Two-phase cancellation model:
  - **Before payment:** both parties can cancel freely
  - **After payment:** seller must use "Issue Refund" — plain cancel is blocked, and the buyer's payment is returned via Stripe automatically

### Product experience

- Shared app layout with a global navbar
- Dashboard with account stats, recent activity, and buyer/seller workspaces
- `/listings` search, filter, and pagination state synced to the URL
- Transaction expiry, release, and sold-state outcomes surfaced in the UI
- Payment status (including `refunded`) visible in transactions, payments, and dashboard views

### Security and business rules

- JWT authentication via `httpOnly` cookie sessions
- bcrypt password hashing
- Server-side ownership enforcement on all mutations
- Seller/buyer role behaviour expressed through foreign keys, not separate account types
- Public marketplace only shows `active` listings
- `sold` and `archived` listings cannot receive new bookings or inquiries
- Transaction completion automatically marks the listing as `sold`
- Completed transactions automatically close competing deal flows
- Transactions can only be completed after a payment is marked as `paid`
- Stripe webhook signature verified server-side on every event

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, React Router v7 |
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Auth | JWT + bcrypt + httpOnly cookie session |
| Payments | Stripe Checkout + webhooks |
| HTTP | Axios |
| API docs | Swagger |

## Getting started

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure environment

Create `backend/.env`:

```env
PORT="3001"
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/pianohub?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:3000"
AUTH_COOKIE_NAME="access_token"
AUTH_COOKIE_SECURE="false"
AUTH_COOKIE_SAME_SITE="lax"
AUTH_COOKIE_MAX_AGE_MS="604800000"
TRANSACTION_ACCEPTED_TTL_HOURS="48"

# Stripe (required for real payment flow)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_SUCCESS_URL="http://localhost:3000/payments/success"
STRIPE_CANCEL_URL="http://localhost:3000/payments/cancel"
STRIPE_CURRENCY="aud"
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL="/api"
```

### 3. Set up the database

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 4. Seed demo data

```bash
cd backend
npx prisma db seed
```

Demo accounts:

- `alice@demo.com` / `demo123!`
- `bob@demo.com` / `demo123!`

Seed behaviour:

- demo users are upserted by email
- demo listings are synced by `owner + title`
- seed can be re-run even if manual listings already exist

### 5. Start the app

Backend:

```bash
cd backend
npm run start:dev
```

Frontend:

```bash
cd frontend
npm run dev
```

App URLs:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Swagger: `http://localhost:3001/docs`

### 6. Enable Stripe payments locally (optional)

To test the real Stripe payment flow, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:

```bash
stripe login
stripe listen --forward-to http://localhost:3001/payments/webhook
```

Copy the `whsec_...` value printed by the CLI into `backend/.env` as `STRIPE_WEBHOOK_SECRET`, then restart the backend.

Use Stripe's test card `4242 4242 4242 4242` with any future expiry and any CVC to simulate a successful payment.

## Deployment and production notes

### Local development path

Use this path when actively building features:

- Run PostgreSQL locally
- Start the backend with `npm run start:dev`
- Start the frontend with `npm run dev`
- Use `npx prisma migrate dev` during schema changes

### Containerized app path

Use this path when you want a more production-like local run:

```bash
docker compose up --build
```

What the current Docker setup does:

- Starts PostgreSQL 16
- Builds and runs the NestJS backend on port `3001`
- Builds the React app and serves it with nginx on port `3000`
- Proxies `/api` and `/uploads` from nginx to the backend
- Persists PostgreSQL data and uploaded files through Docker volumes

Important runtime behaviour:

- Backend container runs `npx prisma migrate deploy` on startup
- Seed is not executed automatically inside Docker
- If you want demo data in containers, run:

```bash
docker compose exec backend npx prisma db seed
```

### Required environment variables

Backend requires:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

For Stripe payments (both development and production):

- `STRIPE_SECRET_KEY` — from your Stripe dashboard
- `STRIPE_WEBHOOK_SECRET` — from `stripe listen` (dev) or the Stripe dashboard webhook endpoint (prod)
- `STRIPE_SUCCESS_URL` — redirect URL after successful payment
- `STRIPE_CANCEL_URL` — redirect URL when buyer cancels checkout
- `STRIPE_CURRENCY` — e.g. `aud`

For production or public demos:

- Use a strong `JWT_SECRET`
- Do not keep the default Docker database password
- Switch from Stripe test keys to live keys
- Register the production webhook URL in the Stripe dashboard and update `STRIPE_WEBHOOK_SECRET`

### Pre-deploy checklist

Before treating a build as deployment-ready, verify:

- Backend compiles with `npm run build`
- Frontend compiles with `npm run build`
- Backend unit tests pass
- Backend e2e baseline passes
- Prisma migrations are up to date
- Seed is optional and only used for demos
- Swagger loads correctly in the target environment
- Image uploads persist in the chosen runtime environment

### Current deployment scope

At this stage, PianoHub is deployment-aware, but not fully production-hardened yet.
The repository already includes:

- Dockerfiles for frontend and backend
- `docker-compose.yml`
- nginx reverse proxy setup for the frontend container
- Prisma migration-based startup for the backend container

Still considered future hardening work:

- production secret management
- HTTPS / reverse proxy decisions outside local Docker
- CI/CD automation
- dedicated production environment guides by provider
- Stripe Connect / marketplace payout (funds routing to sellers)

## Testing

Backend unit tests:

```bash
cd backend
npx jest --runInBand
```

Backend e2e baseline:

```bash
cd backend
npm run test:e2e
```

Frontend type check:

```bash
cd frontend
.\node_modules\.bin\tsc -b --pretty false
```

Current verified baseline:

- unit tests: `74`
- e2e tests: `72`

## Project structure

```text
backend/
  prisma/
  src/
    auth/
    bookings/
    inquiries/
    listings/
      images/
    payments/
    prisma/
    saved-listings/
    transactions/
    users/
frontend/
  src/
    api/
    components/
    constants/
    context/
    pages/
    styles/
```

## Roadmap

- Global search from the navbar
- Provider-specific deployment guides (Railway)
- Stripe Connect / marketplace payout (routing funds to sellers)
- Payment dashboard and seller-side payment analytics refinement
- Further marketplace UX refinement
