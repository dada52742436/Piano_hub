# PianoHub

**A second-hand piano marketplace for Melbourne.**

Find, buy, and sell quality second-hand pianos — all in one place, built for the local Melbourne community.

---

## What is PianoHub?

PianoHub connects piano buyers and sellers across Melbourne. Whether you're looking for a beginner upright or a premium grand piano, you can browse listings, check condition and pricing, and contact sellers directly — without searching through scattered classifieds or social media groups.

---

## Features

### Browse Without an Account
- View all available piano listings in a clean grid layout
- See price (AUD), brand, condition, and location at a glance
- Click any listing for full details and seller information

### Sell Your Piano
- Create a free account and post a listing in minutes
- Describe your piano's brand, condition, price, and Melbourne suburb
- Edit or remove your listing at any time

### Secure by Design
- Accounts protected with industry-standard bcrypt password hashing
- Session tokens (JWT) expire automatically after 7 days
- Only the original seller can edit or delete their own listings — enforced on the server, not just the UI

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8, React Router v7 |
| Backend | NestJS 11, TypeScript (strict) |
| Database | PostgreSQL via Prisma 7 ORM |
| Auth | JWT (Bearer token) + bcrypt |
| HTTP | Axios with automatic token injection |

---

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL running locally on port 5432

### 1. Configure environment

Copy the example env file and fill in your database credentials:

```bash
cp backend/.env.example backend/.env
```

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/auth_demo"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
```

### 2. Set up the database

```bash
cd backend
npx prisma migrate dev
```

### 3. Start the backend

```bash
cd backend
npm run start:dev
# Runs on http://localhost:3001
```

### 4. Start the frontend

```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Roadmap

- [ ] Search and filter by price, brand, and condition
- [ ] Image uploads for listings
- [ ] In-app messaging between buyers and sellers
- [ ] Global navigation bar

---

## License

MIT
