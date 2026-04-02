# PianoHub

Portfolio-quality full-stack marketplace project for second-hand pianos in Melbourne.

## Overview

PianoHub is built to feel more like a real evolving product than a CRUD demo.  
It currently covers authentication, listing management, booking requests, saved listings, seller inquiries, listing images, and ownership-based access control.

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

### Buyer workflows

- Register and log in
- Send booking requests
- Track booking status
- Save listings for later
- Send lightweight inquiries to sellers
- Track and close personal inquiries

### Product experience

- Use a shared app layout with a global navbar
- View a dashboard with account stats, recent activity, and buyer/seller workspaces
- Restore `/listings` search, filter, and pagination state from the URL

### Security and business rules

- JWT authentication
- bcrypt password hashing
- Server-side ownership enforcement
- Seller/buyer role behaviour expressed through foreign keys, not separate account types
- Public marketplace only shows `active` listings
- `sold` and `archived` listings cannot receive new bookings or inquiries

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, React Router v7 |
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Auth | JWT + bcrypt |
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

- unit tests: `43`
- e2e tests: `53`

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
    prisma/
    saved-listings/
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
- Deployment hardening
- Further marketplace UX refinement
