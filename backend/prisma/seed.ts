/**
 * Prisma seed script - creates demo accounts and sample piano listings.
 *
 * Run with:   npx prisma db seed
 * Or directly: npx tsx prisma/seed.ts
 *
 * Idempotent:
 * - Users are upserted by email.
 * - Demo listings are synced by owner + title so the seed can be safely
 *   re-run even when the database already contains user-created listings.
 */

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type DemoListingInput = {
  title: string;
  description: string;
  price: number;
  brand: string | null;
  condition: 'like_new' | 'good' | 'fair' | 'poor';
  location: string;
  ownerId: number;
};

async function upsertDemoListing(data: DemoListingInput) {
  const existing = await prisma.listing.findFirst({
    where: {
      ownerId: data.ownerId,
      title: data.title,
    },
  });

  if (existing) {
    await prisma.listing.update({
      where: { id: existing.id },
      data: {
        description: data.description,
        price: data.price,
        brand: data.brand,
        condition: data.condition,
        location: data.location,
      },
    });
    return 'updated' as const;
  }

  await prisma.listing.create({ data });
  return 'created' as const;
}

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('demo123!', 10);

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

  console.log(`Users ready: alice (id=${alice.id}), bob (id=${bob.id})`);

  const demoListings: DemoListingInput[] = [
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
      title: 'Kawai K300 Upright - Like New',
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
        'Rare opportunity - a genuine Steinway Model O (170 cm) from 1978. Recently restrung and regulation completed by a certified Steinway technician. Polished ebony case. Please contact for viewing arrangements.',
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
    {
      title: 'Bosendorfer 200 Grand Piano',
      description:
        'A truly exceptional 200 cm Bosendorfer grand. Austrian-built, full-length bass bridge, stunning resonance. Ideal for a professional concert hall or private music room. Age: 1991. Professionally regulated in 2024.',
      price: 85000,
      brand: 'Bosendorfer',
      condition: 'like_new',
      location: 'Hawthorn, VIC',
      ownerId: bob.id,
    },
    {
      title: 'Young Chang Baby Grand',
      description:
        'Space-saving 148 cm baby grand by Young Chang. Solid build, bright tone, suitable for a home studio or teaching space. Needs a light tuning after moving and is priced to sell quickly.',
      price: 3200,
      brand: 'Young Chang',
      condition: 'fair',
      location: 'Brunswick, VIC',
      ownerId: bob.id,
    },
    {
      title: 'Upright Piano - Unknown Brand',
      description:
        'Vintage upright piano, circa 1950s. Cosmetically worn but all 88 keys respond. Good for a beginner or someone wanting to learn without a high investment. Buyer must arrange transport.',
      price: 150,
      brand: null,
      condition: 'poor',
      location: 'Dandenong, VIC',
      ownerId: bob.id,
    },
  ];

  let createdCount = 0;
  let updatedCount = 0;

  for (const listing of demoListings) {
    const result = await upsertDemoListing(listing);
    if (result === 'created') {
      createdCount += 1;
    } else {
      updatedCount += 1;
    }
  }

  console.log(`Created ${createdCount} demo listing(s).`);
  console.log(`Updated ${updatedCount} demo listing(s).`);
  console.log('\nSeed complete!');
  console.log('\nDemo accounts (password: demo123!):');
  console.log('  alice@demo.com');
  console.log('  bob@demo.com');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
