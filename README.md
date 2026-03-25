# PianoHub

**A second-hand piano marketplace for Melbourne.**

Find, buy, and sell quality second-hand pianos — all in one place, built for the local Melbourne community.

---

## What is PianoHub?

PianoHub connects piano buyers and sellers across Melbourne. Whether you're looking for a beginner upright or a premium grand piano, you can browse listings, filter by brand or condition, upload photos, and request bookings — all without digging through scattered classifieds or Facebook groups.

---

## Features

### Browse & Search Without an Account
- View all available listings in a paginated grid (6 per page)
- Search by keyword across title, brand, and description
- Filter by condition (Excellent / Good / Fair / Poor)
- Filter by price range and sort by price or date

### Sell Your Piano
- Create a free account and post a listing in minutes
- Describe brand, type (upright / grand / digital / keyboard), condition, price, and suburb
- Upload up to 5 photos per listing (JPEG / PNG / WebP, max 5 MB each)
- Edit or remove your listing at any time from **My Listings**

### Book a Viewing
- Submit a booking request with a preferred date and message to the seller
- Sellers can accept or decline requests from their dashboard
- Booking status tracked: Pending → Accepted / Declined

### Secure by Design
- Passwords hashed with bcrypt (10 rounds)
- JWT Bearer tokens expire after 7 days
- All write operations enforce server-side ownership checks
- File uploads validated by MIME type and size; stored outside the web root

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8, React Router v7 |
| Backend | NestJS 11, TypeScript (strict) |
| Database | PostgreSQL via Prisma 7 ORM |
| Auth | JWT (Bearer token) + bcrypt |
| File upload | Multer + NestJS ServeStaticModule |
| API docs | Swagger UI (`@nestjs/swagger`) |
| HTTP | Axios with automatic token injection |

---

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL running locally on port 5432

> **Docker alternative:** skip the manual steps and use `docker compose up` — see [Docker](#docker) below.

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
```

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/pianohub"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
```

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Set up the database

```bash
cd backend
npx prisma migrate dev
```

### 4. Seed demo data (optional)

```bash
cd backend
npx prisma db seed
```

This creates two demo accounts and 7 sample piano listings:

| Email | Password | Role |
|-------|----------|------|
| alice@demo.com | demo123! | Seller (4 listings) |
| bob@demo.com | demo123! | Seller (3 listings) |

### 5. Start the backend

```bash
cd backend
npm run start:dev
# API:    http://localhost:3001
# Docs:   http://localhost:3001/docs
# Files:  http://localhost:3001/uploads/
```

### 6. Start the frontend

```bash
cd frontend
npm run dev
# App: http://localhost:3000
```

---

## API Documentation

Interactive Swagger UI is available at **[http://localhost:3001/docs](http://localhost:3001/docs)** when the backend is running.

Click **Authorize** and paste a Bearer token (obtained from `POST /auth/login`) to test protected endpoints directly in the browser.

---

## Running Tests

```bash
cd backend
npm test            # unit tests (26 tests, 3 suites)
npm run test:e2e    # end-to-end tests (scaffold only, not yet implemented)
```

---

## Docker

A `docker-compose.yml` is provided at the repository root for a fully containerised setup:

```bash
docker compose up --build
```

Services started:
- **postgres** — PostgreSQL 16 on port 5432
- **backend** — NestJS API on port 3001 (runs migrations + seed automatically)
- **frontend** — Vite preview build on port 3000

Environment variables are defined in `docker-compose.yml`. Override them with a `.env` file at the project root for production use.

---

## Project Structure

```
├── backend/
│   ├── prisma/          # schema, migrations, seed script
│   ├── src/
│   │   ├── auth/        # register, login, JWT strategy
│   │   ├── listings/    # CRUD + search/filter/pagination
│   │   │   └── images/  # photo upload & management
│   │   ├── bookings/    # booking requests workflow
│   │   └── prisma/      # PrismaService (driver-adapter pattern)
│   └── uploads/         # uploaded images (git-ignored)
└── frontend/
    └── src/
        ├── api/         # Axios wrappers
        ├── components/  # shared UI components
        ├── context/     # AuthContext (JWT state)
        ├── pages/       # route-level page components
        └── styles/      # shared style constants
```

---

## Roadmap

- [ ] Real-time notifications (WebSocket)
- [ ] In-app messaging between buyers and sellers
- [ ] Saved / favourited listings
- [ ] Global navigation bar with search

---

## License

MIT
