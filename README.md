# PianoHub

Portfolio-quality full-stack marketplace project for second-hand pianos in Melbourne.

## Overview

PianoHub is built to feel more like a real evolving product than a CRUD demo.  
It currently covers authentication, listing management, bookings, saved listings, inquiries, transactions, a simulated payment layer, listing images, and ownership-based access control.

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
- Progress a transaction from accepted deal flow to completion once payment is marked as paid

### Buyer workflows

- Register and log in
- Send booking requests
- Track booking status
- Save listings for later
- Send lightweight inquiries to sellers
- Track and close personal inquiries
- Start transactions on active listings
- Track personal transaction status and deal progression
- Use a simulated payment flow for accepted transactions
- Review payment attempts from a dedicated `My Payments` page

### Product experience

- Use a shared app layout with a global navbar
- View a dashboard with account stats, recent activity, and buyer/seller workspaces
- Restore `/listings` search, filter, and pagination state from the URL
- Explain transaction expiry, release, and sold-state outcomes in the UI
- Surface simulated payment status in transactions, payments, and dashboard views

### Security and business rules

- JWT authentication via `httpOnly` cookie sessions
- bcrypt password hashing
- Server-side ownership enforcement
- Seller/buyer role behaviour expressed through foreign keys, not separate account types
- Public marketplace only shows `active` listings
- `sold` and `archived` listings cannot receive new bookings or inquiries
- Transaction completion automatically marks the listing as `sold`
- Completed transactions automatically close competing deal flows
- Transactions can only be completed after a payment is marked as `paid`

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, React Router v7 |
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Auth | JWT + bcrypt + httpOnly cookie session |
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
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/pianohub"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
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

For production or public demos:

- Use a strong `JWT_SECRET`
- Do not keep the default Docker database password
- Verify the backend database URL points to the correct database

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
- real payment-provider integration beyond the current simulated payment flow

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
- Provider-specific deployment guides
- Real payment provider integration
- Payment dashboard and seller-side payment analytics refinement
- Further marketplace UX refinement
