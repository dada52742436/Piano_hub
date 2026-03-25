import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService;
  const createdEmails: string[] = [];

  function buildUniqueEmail(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  }

  async function registerUserAndGetToken(input: {
    email: string;
    username: string;
    password?: string;
  }): Promise<string> {
    const password = input.password ?? 'secret123';
    createdEmails.push(input.email);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: input.email,
        username: input.username,
        password,
      })
      .expect(201);

    return response.body.accessToken as string;
  }

  async function createListing(input: {
    accessToken: string;
    title?: string;
    description?: string;
    price?: number;
    brand?: string;
    condition?: string;
    location?: string;
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${input.accessToken}`)
      .send({
        title: input.title ?? 'Yamaha U1 Test Listing',
        description:
          input.description ?? 'Well maintained upright piano for end-to-end testing.',
        price: input.price ?? 3200,
        brand: input.brand ?? 'Yamaha',
        condition: input.condition ?? 'good',
        location: input.location ?? 'Melbourne',
      })
      .expect(201);
  }

  async function createBooking(input: {
    accessToken: string;
    listingId: number;
    message?: string;
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/listings/${input.listingId}/bookings`)
      .set('Authorization', `Bearer ${input.accessToken}`)
      .send({
        message: input.message ?? 'Available this weekend for an inspection.',
      })
      .expect(201);
  }

  async function updateBookingStatus(input: {
    accessToken: string;
    bookingId: number;
    status: 'accepted' | 'rejected' | 'cancelled';
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .patch(`/bookings/${input.bookingId}/status`)
      .set('Authorization', `Bearer ${input.accessToken}`)
      .send({
        status: input.status,
      });
  }

  async function uploadImage(input: {
    accessToken?: string;
    listingId: number;
    filename: string;
    contentType: string;
    content?: Buffer;
  }): Promise<request.Response> {
    const req = request(app.getHttpServer())
      .post(`/listings/${input.listingId}/images`)
      .attach(
        'file',
        input.content ?? Buffer.from('fake-image-content'),
        {
          filename: input.filename,
          contentType: input.contentType,
        },
      );

    if (input.accessToken) {
      req.set('Authorization', `Bearer ${input.accessToken}`);
    }

    return req;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    prismaService = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      const users = await prismaService.prisma.user.findMany({
        where: {
          email: { in: createdEmails },
        },
        select: { id: true },
      });
      const userIds = users.map((user) => user.id);

      if (userIds.length > 0) {
        const uploadedImages = await prismaService.prisma.listingImage.findMany({
          where: {
            listing: { ownerId: { in: userIds } },
          },
          select: { url: true },
        });

        await prismaService.prisma.booking.deleteMany({
          where: {
            OR: [
              { buyerId: { in: userIds } },
              { listing: { ownerId: { in: userIds } } },
            ],
          },
        });

        await prismaService.prisma.listingImage.deleteMany({
          where: {
            listing: { ownerId: { in: userIds } },
          },
        });

        await prismaService.prisma.listing.deleteMany({
          where: {
            ownerId: { in: userIds },
          },
        });

        await Promise.all(
          uploadedImages.map(async (image) => {
            const filename = image.url.replace('/uploads/', '');
            const filePath = join(process.cwd(), 'uploads', filename);
            await unlink(filePath).catch((err: NodeJS.ErrnoException) => {
              if (err.code !== 'ENOENT') throw err;
            });
          }),
        );
      }

      await prismaService.prisma.user.deleteMany({
        where: {
          email: { in: createdEmails },
        },
      });
    }

    await app.close();
  });

  it('POST /auth/register should create a new user and return an access token', async () => {
    const email = buildUniqueEmail('e2e-register');

    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'e2e-user',
        password: 'secret123',
      })
      .expect(201)
      .expect((response) => {
        createdEmails.push(email);
        expect(response.body.accessToken).toEqual(expect.any(String));
        expect(response.body.user).toMatchObject({
          email,
          username: 'e2e-user',
        });
        expect(response.body.user.id).toEqual(expect.any(Number));
      });
  });

  it('POST /auth/register should return 409 when the email is already registered', async () => {
    const email = buildUniqueEmail('e2e-duplicate');

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'first-user',
        password: 'secret123',
      })
      .expect(201);
    createdEmails.push(email);

    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'second-user',
        password: 'secret123',
      })
      .expect(409);
  });

  it('POST /auth/login should return an access token for valid credentials', async () => {
    const email = buildUniqueEmail('e2e-login');

    await registerUserAndGetToken({
      email,
      username: 'login-user',
    });

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'secret123',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.accessToken).toEqual(expect.any(String));
        expect(response.body.user).toMatchObject({
          email,
          username: 'login-user',
        });
      });
  });

  it('POST /auth/login should return 401 for invalid credentials', async () => {
    const email = buildUniqueEmail('e2e-invalid-login');

    await registerUserAndGetToken({
      email,
      username: 'invalid-login-user',
    });

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'wrong-password',
      })
      .expect(401);
  });

  it('GET /protected/profile should return the current user for a valid bearer token', async () => {
    const email = buildUniqueEmail('e2e-profile');

    const accessToken = await registerUserAndGetToken({
      email,
      username: 'profile-user',
    });

    return request(app.getHttpServer())
      .get('/protected/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.message).toEqual(expect.any(String));
        expect(response.body.user).toMatchObject({
          email,
          username: 'profile-user',
        });
        expect(response.body.user.password).toBeUndefined();
      });
  });

  it('GET /protected/profile should return 401 without a bearer token', async () => {
    return request(app.getHttpServer())
      .get('/protected/profile')
      .expect(401);
  });

  it('GET /listings/mine should return 401 without authentication', async () => {
    return request(app.getHttpServer())
      .get('/listings/mine')
      .expect(401);
  });

  it('POST /listings should return 401 without authentication', async () => {
    return request(app.getHttpServer())
      .post('/listings')
      .send({
        title: 'Unauthenticated Listing',
        description: 'This request should fail because no bearer token is provided.',
        price: 1000,
        condition: 'good',
      })
      .expect(401);
  });

  it('POST /listings should create a listing for the authenticated user', async () => {
    const email = buildUniqueEmail('e2e-listing-owner');
    const accessToken = await registerUserAndGetToken({
      email,
      username: 'listing-owner',
    });

    const response = await createListing({ accessToken });

    expect(response.status).toBe(201);
    expect(response.body.id).toEqual(expect.any(Number));
    expect(response.body.title).toBe('Yamaha U1 Test Listing');
    expect(response.body.ownerId).toEqual(expect.any(Number));
    expect(response.body.owner).toMatchObject({
      username: 'listing-owner',
    });
  });

  it('GET /listings/:id should return the requested listing', async () => {
    const email = buildUniqueEmail('e2e-listing-detail');
    const accessToken = await registerUserAndGetToken({
      email,
      username: 'listing-detail-owner',
    });

    const createdListing = await createListing({
      accessToken,
      title: 'Steinway Model K',
      description: 'A detailed listing used to verify the public detail endpoint.',
      price: 8900,
      brand: 'Steinway',
      condition: 'like_new',
      location: 'Brisbane',
    });

    return request(app.getHttpServer())
      .get(`/listings/${createdListing.body.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.id).toBe(createdListing.body.id);
        expect(response.body.title).toBe('Steinway Model K');
        expect(response.body.brand).toBe('Steinway');
        expect(response.body.condition).toBe('like_new');
        expect(response.body.owner).toMatchObject({
          username: 'listing-detail-owner',
        });
      });
  });

  it('GET /listings/mine should return only the current user listings', async () => {
    const firstOwnerEmail = buildUniqueEmail('e2e-mine-owner-a');
    const secondOwnerEmail = buildUniqueEmail('e2e-mine-owner-b');

    const firstOwnerToken = await registerUserAndGetToken({
      email: firstOwnerEmail,
      username: 'owner-a',
    });
    const secondOwnerToken = await registerUserAndGetToken({
      email: secondOwnerEmail,
      username: 'owner-b',
    });

    await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${firstOwnerToken}`)
      .send({
        title: 'Owner A Listing',
        description: 'Listing owned by the first user for /listings/mine.',
        price: 2800,
        brand: 'Kawai',
        condition: 'good',
        location: 'Melbourne',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${secondOwnerToken}`)
      .send({
        title: 'Owner B Listing',
        description: 'Listing owned by the second user for /listings/mine.',
        price: 4100,
        brand: 'Yamaha',
        condition: 'like_new',
        location: 'Sydney',
      })
      .expect(201);

    return request(app.getHttpServer())
      .get('/listings/mine')
      .set('Authorization', `Bearer ${firstOwnerToken}`)
      .expect(200)
      .expect((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          title: 'Owner A Listing',
          owner: {
            username: 'owner-a',
          },
        });
      });
  });

  it('PATCH /listings/:id should update the listing for the owner', async () => {
    const email = buildUniqueEmail('e2e-listing-update');
    const accessToken = await registerUserAndGetToken({
      email,
      username: 'listing-update-owner',
    });

    const createdListing = await createListing({
      accessToken,
      title: 'Before Update',
      description: 'Listing before update for owner editing verification.',
      price: 2500,
      brand: 'Kawai',
      condition: 'good',
      location: 'Melbourne',
    });

    return request(app.getHttpServer())
      .patch(`/listings/${createdListing.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'After Update',
        price: 2750,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.id).toBe(createdListing.body.id);
        expect(response.body.title).toBe('After Update');
        expect(response.body.price).toBe(2750);
      });
  });

  it('PATCH /listings/:id should return 403 for a non-owner', async () => {
    const ownerEmail = buildUniqueEmail('e2e-listing-owner-only');
    const intruderEmail = buildUniqueEmail('e2e-listing-intruder');

    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'real-owner',
    });
    const intruderToken = await registerUserAndGetToken({
      email: intruderEmail,
      username: 'intruder-user',
    });

    const createdListing = await createListing({
      accessToken: ownerToken,
      title: 'Protected Listing',
      description: 'Listing used to verify that non-owners cannot edit it.',
    });

    return request(app.getHttpServer())
      .patch(`/listings/${createdListing.body.id}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({
        title: 'Intruder Update',
      })
      .expect(403);
  });

  it('DELETE /listings/:id should delete the listing for the owner', async () => {
    const email = buildUniqueEmail('e2e-listing-delete');
    const accessToken = await registerUserAndGetToken({
      email,
      username: 'listing-delete-owner',
    });

    const createdListing = await createListing({
      accessToken,
      title: 'Delete Me',
      description: 'Listing created to verify the owner delete endpoint.',
    });

    await request(app.getHttpServer())
      .delete(`/listings/${createdListing.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.message).toContain('deleted successfully');
      });

    return request(app.getHttpServer())
      .get(`/listings/${createdListing.body.id}`)
      .expect(404);
  });

  it('DELETE /listings/:id should return 403 for a non-owner', async () => {
    const ownerEmail = buildUniqueEmail('e2e-delete-owner');
    const intruderEmail = buildUniqueEmail('e2e-delete-intruder');

    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'delete-owner',
    });
    const intruderToken = await registerUserAndGetToken({
      email: intruderEmail,
      username: 'delete-intruder',
    });

    const createdListing = await createListing({
      accessToken: ownerToken,
      title: 'Do Not Delete',
      description: 'Listing used to verify that non-owners cannot delete it.',
    });

    return request(app.getHttpServer())
      .delete(`/listings/${createdListing.body.id}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);
  });

  it('GET /listings/:id should return 404 when the listing does not exist', async () => {
    return request(app.getHttpServer())
      .get('/listings/999999')
      .expect(404);
  });

  it('GET /listings should support public search and filtering', async () => {
    const ownerEmail = buildUniqueEmail('e2e-public-listings-owner');
    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'public-owner',
    });

    await createListing({
      accessToken: ownerToken,
      title: 'Aurora Search Piano',
      description: 'Unique searchable upright piano listing for public query testing.',
      price: 3600,
      brand: 'SearchBrandAlpha',
      condition: 'good',
      location: 'Melbourne',
    });

    await createListing({
      accessToken: ownerToken,
      title: 'Background Listing',
      description: 'Secondary listing that should be excluded by the public filters.',
      price: 9100,
      brand: 'SearchBrandBeta',
      condition: 'fair',
      location: 'Sydney',
    });

    return request(app.getHttpServer())
      .get('/listings')
      .query({
        search: 'Aurora Search Piano',
        brand: 'SearchBrandAlpha',
        condition: 'good',
        minPrice: 3000,
        maxPrice: 4000,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.total).toBe(1);
        expect(response.body.page).toBe(1);
        expect(response.body.limit).toBe(12);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toMatchObject({
          title: 'Aurora Search Piano',
          brand: 'SearchBrandAlpha',
          condition: 'good',
        });
      });
  });

  it('GET /listings should return paginated results', async () => {
    const ownerEmail = buildUniqueEmail('e2e-paginated-owner');
    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'page-owner',
    });

    await createListing({
      accessToken: ownerToken,
      title: 'Page Listing One',
      description: 'First listing for pagination verification.',
      price: 2000,
      brand: 'PageBrandGamma',
      condition: 'good',
    });
    await createListing({
      accessToken: ownerToken,
      title: 'Page Listing Two',
      description: 'Second listing for pagination verification.',
      price: 3000,
      brand: 'PageBrandGamma',
      condition: 'good',
    });
    await createListing({
      accessToken: ownerToken,
      title: 'Page Listing Three',
      description: 'Third listing for pagination verification.',
      price: 4000,
      brand: 'PageBrandGamma',
      condition: 'good',
    });

    return request(app.getHttpServer())
      .get('/listings')
      .query({
        brand: 'PageBrandGamma',
        page: 2,
        limit: 2,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.total).toBe(3);
        expect(response.body.page).toBe(2);
        expect(response.body.limit).toBe(2);
        expect(response.body.totalPages).toBe(2);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].brand).toBe('PageBrandGamma');
      });
  });

  it('POST /listings/:listingId/bookings should create a booking for a buyer', async () => {
    const sellerEmail = buildUniqueEmail('e2e-booking-seller');
    const buyerEmail = buildUniqueEmail('e2e-booking-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'booking-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'booking-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Booking Target Listing',
      description: 'Listing created to verify booking creation by a buyer.',
    });

    return createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'I would like to view the piano this Saturday.',
    }).then((response) => {
      expect(response.body.id).toEqual(expect.any(Number));
      expect(response.body.status).toBe('pending');
      expect(response.body.message).toBe('I would like to view the piano this Saturday.');
      expect(response.body.listing).toMatchObject({
        id: listing.body.id,
        title: 'Booking Target Listing',
      });
      expect(response.body.buyer).toMatchObject({
        username: 'booking-buyer',
      });
    });
  });

  it('GET /bookings/mine should return only the current buyer bookings', async () => {
    const sellerEmail = buildUniqueEmail('e2e-bookings-mine-seller');
    const firstBuyerEmail = buildUniqueEmail('e2e-bookings-mine-a');
    const secondBuyerEmail = buildUniqueEmail('e2e-bookings-mine-b');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'mine-seller',
    });
    const firstBuyerToken = await registerUserAndGetToken({
      email: firstBuyerEmail,
      username: 'buyer-a',
    });
    const secondBuyerToken = await registerUserAndGetToken({
      email: secondBuyerEmail,
      username: 'buyer-b',
    });

    const firstListing = await createListing({
      accessToken: sellerToken,
      title: 'Buyer A Target',
      description: 'Listing for checking the first buyer bookings list.',
    });
    const secondListing = await createListing({
      accessToken: sellerToken,
      title: 'Buyer B Target',
      description: 'Listing for checking the second buyer bookings list.',
    });

    await createBooking({
      accessToken: firstBuyerToken,
      listingId: firstListing.body.id,
      message: 'Buyer A booking message.',
    });
    await createBooking({
      accessToken: secondBuyerToken,
      listingId: secondListing.body.id,
      message: 'Buyer B booking message.',
    });

    return request(app.getHttpServer())
      .get('/bookings/mine')
      .set('Authorization', `Bearer ${firstBuyerToken}`)
      .expect(200)
      .expect((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          message: 'Buyer A booking message.',
          status: 'pending',
          listing: {
            title: 'Buyer A Target',
          },
        });
      });
  });

  it('GET /listings/:listingId/bookings should return bookings to the listing owner', async () => {
    const sellerEmail = buildUniqueEmail('e2e-listing-bookings-seller');
    const buyerEmail = buildUniqueEmail('e2e-listing-bookings-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'bookings-owner',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'bookings-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Seller Booking View',
      description: 'Listing used to verify seller access to listing bookings.',
    });

    await createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Please let me know your preferred inspection time.',
    });

    return request(app.getHttpServer())
      .get(`/listings/${listing.body.id}/bookings`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200)
      .expect((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          status: 'pending',
          message: 'Please let me know your preferred inspection time.',
          buyer: {
            username: 'bookings-buyer',
          },
        });
      });
  });

  it('POST /listings/:listingId/bookings should return 400 when booking your own listing', async () => {
    const sellerEmail = buildUniqueEmail('e2e-self-booking-owner');
    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'self-booking-owner',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Own Listing',
      description: 'Listing used to verify that owners cannot book themselves.',
    });

    return request(app.getHttpServer())
      .post(`/listings/${listing.body.id}/bookings`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        message: 'Trying to book my own listing.',
      })
      .expect(400);
  });

  it('POST /listings/:listingId/bookings should return 409 for a duplicate booking', async () => {
    const sellerEmail = buildUniqueEmail('e2e-duplicate-booking-seller');
    const buyerEmail = buildUniqueEmail('e2e-duplicate-booking-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'dup-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'dup-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Duplicate Booking Target',
      description: 'Listing used to verify duplicate booking protection.',
    });

    await createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'First booking request.',
    });

    return request(app.getHttpServer())
      .post(`/listings/${listing.body.id}/bookings`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        message: 'Second booking request.',
      })
      .expect(409);
  });

  it('GET /listings/:listingId/bookings should return 403 for a non-owner', async () => {
    const sellerEmail = buildUniqueEmail('e2e-bookings-view-seller');
    const buyerEmail = buildUniqueEmail('e2e-bookings-view-buyer');
    const outsiderEmail = buildUniqueEmail('e2e-bookings-view-outsider');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'view-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'view-buyer',
    });
    const outsiderToken = await registerUserAndGetToken({
      email: outsiderEmail,
      username: 'view-outsider',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Owner Only Booking View',
      description: 'Listing used to verify seller-only booking visibility.',
    });

    await createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'A valid booking for the owner-only view test.',
    });

    return request(app.getHttpServer())
      .get(`/listings/${listing.body.id}/bookings`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('PATCH /bookings/:id/status should allow the seller to accept a pending booking', async () => {
    const sellerEmail = buildUniqueEmail('e2e-booking-accept-seller');
    const buyerEmail = buildUniqueEmail('e2e-booking-accept-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'accept-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'accept-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Accept Booking Listing',
      description: 'Listing used to verify seller acceptance of a booking.',
    });

    const booking = await createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Please confirm if this weekend works.',
    });

    return updateBookingStatus({
      accessToken: sellerToken,
      bookingId: booking.body.id,
      status: 'accepted',
    })
      .then((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('accepted');
        expect(response.body.listing).toMatchObject({
          id: listing.body.id,
          title: 'Accept Booking Listing',
        });
      });
  });

  it('PATCH /bookings/:id/status should allow the buyer to cancel a pending booking', async () => {
    const sellerEmail = buildUniqueEmail('e2e-booking-cancel-seller');
    const buyerEmail = buildUniqueEmail('e2e-booking-cancel-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'cancel-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'cancel-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Cancel Booking Listing',
      description: 'Listing used to verify buyer cancellation of a booking.',
    });

    const booking = await createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'I may need to cancel this booking.',
    });

    return updateBookingStatus({
      accessToken: buyerToken,
      bookingId: booking.body.id,
      status: 'cancelled',
    })
      .then((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('cancelled');
        expect(response.body.buyer).toMatchObject({
          username: 'cancel-buyer',
        });
      });
  });

  it('PATCH /bookings/:id/status should return 400 for an invalid role transition', async () => {
    const sellerEmail = buildUniqueEmail('e2e-invalid-transition-seller');
    const buyerEmail = buildUniqueEmail('e2e-invalid-transition-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'badtrans-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'badtrans-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Invalid Transition Listing',
      description: 'Listing used to verify invalid booking status transitions.',
    });

    const booking = await createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Pending booking before invalid transition attempt.',
    });

    return updateBookingStatus({
      accessToken: buyerToken,
      bookingId: booking.body.id,
      status: 'accepted',
    }).then((response) => {
      expect(response.status).toBe(400);
    });
  });

  it('PATCH /bookings/:id/status should allow the seller to reject a pending booking', async () => {
    const sellerEmail = buildUniqueEmail('e2e-booking-reject-seller');
    const buyerEmail = buildUniqueEmail('e2e-booking-reject-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'reject-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'reject-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Reject Booking Listing',
      description: 'Listing used to verify seller rejection of a booking.',
    });

    const booking = await createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Please let me know if this time is available.',
    });

    return updateBookingStatus({
      accessToken: sellerToken,
      bookingId: booking.body.id,
      status: 'rejected',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('rejected');
      expect(response.body.listing).toMatchObject({
        id: listing.body.id,
        title: 'Reject Booking Listing',
      });
    });
  });

  it('PATCH /bookings/:id/status should return 403 for a user who is not part of the booking', async () => {
    const sellerEmail = buildUniqueEmail('e2e-third-party-seller');
    const buyerEmail = buildUniqueEmail('e2e-third-party-buyer');
    const outsiderEmail = buildUniqueEmail('e2e-third-party-outsider');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'party-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'party-buyer',
    });
    const outsiderToken = await registerUserAndGetToken({
      email: outsiderEmail,
      username: 'outsider',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Third Party Status Listing',
      description: 'Listing used to verify outsider booking status changes are forbidden.',
    });

    const booking = await createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Booking before outsider update attempt.',
    });

    return updateBookingStatus({
      accessToken: outsiderToken,
      bookingId: booking.body.id,
      status: 'cancelled',
    }).then((response) => {
      expect(response.status).toBe(403);
    });
  });

  it('PATCH /bookings/:id/status should return 400 when changing a non-pending booking', async () => {
    const sellerEmail = buildUniqueEmail('e2e-terminal-status-seller');
    const buyerEmail = buildUniqueEmail('e2e-terminal-status-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'term-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'term-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Terminal Status Listing',
      description: 'Listing used to verify non-pending bookings cannot be changed again.',
    });

    const booking = await createBooking({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Booking before terminal status validation.',
    });

    await updateBookingStatus({
      accessToken: sellerToken,
      bookingId: booking.body.id,
      status: 'accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    return updateBookingStatus({
      accessToken: buyerToken,
      bookingId: booking.body.id,
      status: 'cancelled',
    }).then((response) => {
      expect(response.status).toBe(400);
    });
  });

  it('POST /listings/:listingId/images should upload an image for the owner', async () => {
    const ownerEmail = buildUniqueEmail('e2e-image-upload-owner');
    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'img-owner',
    });

    const listing = await createListing({
      accessToken: ownerToken,
      title: 'Image Upload Listing',
      description: 'Listing used to verify owner image upload.',
    });

    return uploadImage({
      accessToken: ownerToken,
      listingId: listing.body.id,
      filename: 'test-upload.png',
      contentType: 'image/png',
      content: Buffer.from([137, 80, 78, 71]),
    }).then((response) => {
      expect(response.status).toBe(201);
      expect(response.body.id).toEqual(expect.any(Number));
      expect(response.body.listingId).toBe(listing.body.id);
      expect(response.body.url).toMatch(/^\/uploads\/listing-/);
      expect(response.body.order).toBe(0);
    });
  });

  it('POST /listings/:listingId/images should return 403 for a non-owner', async () => {
    const ownerEmail = buildUniqueEmail('e2e-image-owner');
    const intruderEmail = buildUniqueEmail('e2e-image-intruder');

    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'img-ownr',
    });
    const intruderToken = await registerUserAndGetToken({
      email: intruderEmail,
      username: 'img-intr',
    });

    const listing = await createListing({
      accessToken: ownerToken,
      title: 'Owner Only Image Listing',
      description: 'Listing used to verify that non-owners cannot upload images.',
    });

    return uploadImage({
      accessToken: intruderToken,
      listingId: listing.body.id,
      filename: 'intruder.png',
      contentType: 'image/png',
      content: Buffer.from([137, 80, 78, 71]),
    }).then((response) => {
      expect(response.status).toBe(403);
    });
  });

  it('POST /listings/:listingId/images should return 400 for an invalid file type', async () => {
    const ownerEmail = buildUniqueEmail('e2e-image-type-owner');
    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'img-type',
    });

    const listing = await createListing({
      accessToken: ownerToken,
      title: 'Invalid Image Type Listing',
      description: 'Listing used to verify invalid upload MIME type handling.',
    });

    return uploadImage({
      accessToken: ownerToken,
      listingId: listing.body.id,
      filename: 'not-an-image.txt',
      contentType: 'text/plain',
      content: Buffer.from('plain text file'),
    }).then((response) => {
      expect(response.status).toBe(400);
    });
  });

  it('DELETE /listings/:listingId/images/:imageId should delete an image for the owner', async () => {
    const ownerEmail = buildUniqueEmail('e2e-image-delete-owner');
    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'img-del',
    });

    const listing = await createListing({
      accessToken: ownerToken,
      title: 'Image Delete Listing',
      description: 'Listing used to verify image deletion by the owner.',
    });

    const image = await uploadImage({
      accessToken: ownerToken,
      listingId: listing.body.id,
      filename: 'delete-me.png',
      contentType: 'image/png',
      content: Buffer.from([137, 80, 78, 71]),
    });

    return request(app.getHttpServer())
      .delete(`/listings/${listing.body.id}/images/${image.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.message).toContain(`${image.body.id}`);
      });
  });

  it('DELETE /listings/:listingId/images/:imageId should return 403 for a non-owner', async () => {
    const ownerEmail = buildUniqueEmail('e2e-image-del-owner');
    const intruderEmail = buildUniqueEmail('e2e-image-del-intr');

    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'img-del-o',
    });
    const intruderToken = await registerUserAndGetToken({
      email: intruderEmail,
      username: 'img-del-i',
    });

    const listing = await createListing({
      accessToken: ownerToken,
      title: 'Protected Image Listing',
      description: 'Listing used to verify non-owner image deletion is forbidden.',
    });

    const image = await uploadImage({
      accessToken: ownerToken,
      listingId: listing.body.id,
      filename: 'protected.png',
      contentType: 'image/png',
      content: Buffer.from([137, 80, 78, 71]),
    });

    return request(app.getHttpServer())
      .delete(`/listings/${listing.body.id}/images/${image.body.id}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);
  });

  it('DELETE /listings/:listingId/images/:imageId should return 404 for a missing image', async () => {
    const ownerEmail = buildUniqueEmail('e2e-image-missing-owner');
    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'img-miss',
    });

    const listing = await createListing({
      accessToken: ownerToken,
      title: 'Missing Image Listing',
      description: 'Listing used to verify missing image deletion handling.',
    });

    return request(app.getHttpServer())
      .delete(`/listings/${listing.body.id}/images/999999`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
