/**
 * Prisma seed script — creates demo accounts and sample piano listings.
 *
 * Run with:   npx prisma db seed
 * Or directly: npx tsx prisma/seed.ts
 *
 * Idempotent: users are upserted (won't duplicate on re-runs).
 * Listings are only created if the total count is 0 (prevents duplicates
 * while still allowing the command to be re-run safely after data is cleared).
 */

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱  Seeding database...');

  const hashedPassword = await bcrypt.hash('demo123!', 10);

  // ── Demo users ────────────────────────────────────────────────────────────
  // Both accounts use the same password for easy demo access.

  const alice = await prisma.user.upsert({
    where: { email: 'alice@demo.com' },
    update: {},
    create: {
      email: 'alice@demo.com',
      username: 'alice',
      password: hashedPassword,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@demo.com' },
    update: {},
    create: {
      email: 'bob@demo.com',
      username: 'bob',
      password: hashedPassword,
    },
  });

  console.log(`  ✓ Users: alice (id=${alice.id}), bob (id=${bob.id})`);

  // ── Sample listings ───────────────────────────────────────────────────────
  // Only seed if the DB is empty — prevents duplicate listings on re-runs.

  const existingCount = await prisma.listing.count();
  if (existingCount > 0) {
    console.log(`  ↩  ${existingCount} listing(s) already exist — skipping listing seed.`);
    return;
  }

  const listings = await prisma.listing.createMany({
    data: [
      // Alice's listings
      {
        title: 'Yamaha U1 Upright Piano',
        description:
          'Classic Yamaha U1 in excellent condition. Originally purchased from a music school, well-maintained with regular tuning. Great for intermediate to advanced players. Comes with matching bench.',
        price: 5500,
        brand: 'Yamaha',
        condition: 'like_new',
        location: 'Richmond, VIC',
        ownerId: alice.id,
      },
      {
        title: 'Kawai K300 Upright — Like New',
        description:
          'Barely played Kawai K300, purchased new in 2022 and used for light practice only. Still under manufacturer warranty. Absolutely superb touch and tone. Selling due to relocation.',
        price: 7800,
        brand: 'Kawai',
        condition: 'like_new',
        location: 'South Yarra, VIC',
        ownerId: alice.id,
      },
      {
        title: 'Steinway Model O Grand Piano',
        description:
          'Rare opportunity — a genuine Steinway Model O (170 cm) from 1978. Recently restrung and regulation completed by a certified Steinway technician. Polished ebony case. Please contact for viewing arrangements.',
        price: 42000,
        brand: 'Steinway',
        condition: 'good',
        location: 'Toorak, VIC',
        ownerId: alice.id,
      },
      {
        title: 'Casio PX-S3100 Digital Piano',
        description:
          'Slim Casio Privia digital piano in good working order. 88 weighted keys, built-in speakers, Bluetooth MIDI. Some minor scratches on the side panel but plays perfectly. Includes stand and sustain pedal.',
        price: 650,
        brand: 'Casio',
        condition: 'good',
        location: 'Fitzroy North, VIC',
        ownerId: alice.id,
      },
      // Bob's listings
      {
        title: 'Bösendorfer 200 Grand Piano',
        description:
          'A truly exceptional 200 cm Bösendorfer grand. Austrian-built, full-length bass bridge, stunning resonance. Ideal for a professional concert hall or private music room. Age: 1991. Professionally regulated 2024.',
        price: 85000,
        brand: 'Bösendorfer',
        condition: 'like_new',
        location: 'Hawthorn, VIC',
        ownerId: bob.id,
      },
      {
        title: 'Young Chang Baby Grand',
        description:
          'Space-saving 148 cm baby grand by Young Chang. Solid build, bright tone, suitable for a home studio or teaching space. Needs a light tuning after move — priced to sell quickly.',
        price: 3200,
        brand: 'Young Chang',
        condition: 'fair',
        location: 'Brunswick, VIC',
        ownerId: bob.id,
      },
      {
        title: 'Upright Piano — Unknown Brand',
        description:
          'Vintage upright piano, circa 1950s. Cosmetically worn but all 88 keys respond. Good for a beginner or someone wanting to learn without a high investment. Buyer must arrange transport.',
        price: 150,
        brand: null,
        condition: 'poor',
        location: 'Dandenong, VIC',
        ownerId: bob.id,
      },
    ],
  });

  console.log(`  ✓ Created ${listings.count} sample listing(s).`);
  console.log('\n✅  Seed complete!');
  console.log('\n  Demo accounts (password: demo123!):');
  console.log('    alice@demo.com');
  console.log('    bob@demo.com');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
