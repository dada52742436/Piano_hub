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

  function extractAuthCookie(response: request.Response): string {
    const cookies = response.headers['set-cookie'];
    const authCookie = cookies?.find((cookie) => cookie.startsWith('access_token='));

    expect(authCookie).toBeDefined();
    return authCookie as string;
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

  async function saveListing(input: {
    accessToken: string;
    listingId: number;
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/saved-listings/${input.listingId}`)
      .set('Authorization', `Bearer ${input.accessToken}`)
      .expect(201);
  }

  async function createInquiry(input: {
    accessToken: string;
    listingId: number;
    message?: string;
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/listings/${input.listingId}/inquiries`)
      .set('Authorization', `Bearer ${input.accessToken}`)
      .send({
        message: input.message ?? 'I would love to know if this piano is still available.',
      })
      .expect(201);
  }

  async function createTransaction(input: {
    accessToken: string;
    listingId: number;
    offeredPrice?: number;
    message?: string;
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/listings/${input.listingId}/transactions`)
      .set('Authorization', `Bearer ${input.accessToken}`)
      .send({
        offeredPrice: input.offeredPrice ?? 3200,
        message: input.message ?? 'Ready to move forward with this deal.',
      })
      .expect(201);
  }

  async function createPayment(input: {
    accessToken: string;
    transactionId: number;
    amount?: number;
    providerPaymentId?: string;
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/transactions/${input.transactionId}/payments`)
      .set('Authorization', `Bearer ${input.accessToken}`)
      .send({
        amount: input.amount ?? 3200,
        providerPaymentId: input.providerPaymentId,
      })
      .expect(201);
  }

  async function simulatePayment(input: {
    accessToken: string;
    paymentId: number;
    status: 'paid' | 'failed' | 'cancelled';
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .patch(`/payments/${input.paymentId}/simulate`)
      .set('Authorization', `Bearer ${input.accessToken}`)
      .send({
        status: input.status,
      });
  }

  async function updateTransactionStatus(input: {
    accessToken: string;
    transactionId: number;
    status:
      | 'seller_accepted'
      | 'buyer_confirmed'
      | 'completed'
      | 'cancelled';
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .patch(`/transactions/${input.transactionId}/status`)
      .set('Authorization', `Bearer ${input.accessToken}`)
      .send({
        status: input.status,
      });
  }

  async function updateInquiryStatus(input: {
    accessToken: string;
    inquiryId: number;
    status: 'open' | 'closed';
  }): Promise<request.Response> {
    return request(app.getHttpServer())
      .patch(`/inquiries/${input.inquiryId}/status`)
      .set('Authorization', `Bearer ${input.accessToken}`)
      .send({
        status: input.status,
      });
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

        await prismaService.prisma.inquiry.deleteMany({
          where: {
            OR: [
              { requesterId: { in: userIds } },
              { listing: { ownerId: { in: userIds } } },
            ],
          },
        });

        await prismaService.prisma.payment.deleteMany({
          where: {
            OR: [
              { buyerId: { in: userIds } },
              { transaction: { listing: { ownerId: { in: userIds } } } },
            ],
          },
        });

        await prismaService.prisma.transaction.deleteMany({
          where: {
            OR: [
              { buyerId: { in: userIds } },
              { listing: { ownerId: { in: userIds } } },
            ],
          },
        });

        await prismaService.prisma.savedListing.deleteMany({
          where: {
            OR: [
              { userId: { in: userIds } },
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
        expect(extractAuthCookie(response)).toContain('HttpOnly');
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
        expect(extractAuthCookie(response)).toContain('HttpOnly');
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

  it('GET /protected/profile should return the current user for a valid auth cookie', async () => {
    const email = buildUniqueEmail('e2e-cookie-profile');

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        username: 'cookie-user',
        password: 'secret123',
      })
      .expect(201);

    createdEmails.push(email);
    const authCookie = extractAuthCookie(registerResponse);

    return request(app.getHttpServer())
      .get('/protected/profile')
      .set('Cookie', authCookie)
      .expect(200)
      .expect((response) => {
        expect(response.body.user).toMatchObject({
          email,
          username: 'cookie-user',
        });
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

  it('GET /listings should exclude sold and archived listings from the public result', async () => {
    const ownerEmail = buildUniqueEmail('e2e-status-filter-owner');
    const ownerToken = await registerUserAndGetToken({
      email: ownerEmail,
      username: 'status-ownr',
    });

    const activeListing = await createListing({
      accessToken: ownerToken,
      title: 'Visible Active Listing',
      description: 'This active listing should remain visible in public results.',
      brand: 'StatusFilterBrand',
    });
    const soldListing = await createListing({
      accessToken: ownerToken,
      title: 'Hidden Sold Listing',
      description: 'This sold listing should not appear in public results.',
      brand: 'StatusFilterBrand',
    });
    const archivedListing = await createListing({
      accessToken: ownerToken,
      title: 'Hidden Archived Listing',
      description: 'This archived listing should not appear in public results.',
      brand: 'StatusFilterBrand',
    });

    await request(app.getHttpServer())
      .patch(`/listings/${soldListing.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'sold' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/listings/${archivedListing.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'archived' })
      .expect(200);

    return request(app.getHttpServer())
      .get('/listings')
      .query({ brand: 'StatusFilterBrand' })
      .expect(200)
      .expect((response) => {
        expect(response.body.total).toBe(1);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe(activeListing.body.id);
        expect(response.body.data[0].status).toBe('active');
      });
  });

  it('POST /saved-listings/:listingId should save a listing for the current user', async () => {
    const sellerToken = await registerUserAndGetToken({
      email: buildUniqueEmail('e2e-saved-seller'),
      username: 'savedsell',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buildUniqueEmail('e2e-saved-buyer'),
      username: 'savedbuyr',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Saved Listing Target',
      description: 'Listing used to verify saving functionality.',
    });

    const response = await saveListing({
      accessToken: buyerToken,
      listingId: listing.body.id,
    });

    expect(response.body.listingId).toBe(listing.body.id);
    expect(response.body.listing).toMatchObject({
      title: 'Saved Listing Target',
    });
  });

  it('POST /saved-listings/:listingId should return 409 for a duplicate save', async () => {
    const sellerToken = await registerUserAndGetToken({
      email: buildUniqueEmail('e2e-saved-dup-seller'),
      username: 'savdups',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buildUniqueEmail('e2e-saved-dup-buyer'),
      username: 'savdupb',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Duplicate Saved Listing',
      description: 'Listing used to verify duplicate saves are rejected.',
    });

    await saveListing({
      accessToken: buyerToken,
      listingId: listing.body.id,
    });

    return request(app.getHttpServer())
      .post(`/saved-listings/${listing.body.id}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(409);
  });

  it('GET /saved-listings/mine should return the current user saved listings', async () => {
    const sellerToken = await registerUserAndGetToken({
      email: buildUniqueEmail('e2e-saved-list-seller'),
      username: 'savelsts',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buildUniqueEmail('e2e-saved-list-buyer'),
      username: 'savelstb',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Saved Listing Mine',
      description: 'Listing used to verify the saved listings page endpoint.',
    });

    await saveListing({
      accessToken: buyerToken,
      listingId: listing.body.id,
    });

    return request(app.getHttpServer())
      .get('/saved-listings/mine')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].listing).toMatchObject({
          title: 'Saved Listing Mine',
        });
      });
  });

  it('DELETE /saved-listings/:listingId should remove a saved listing', async () => {
    const sellerToken = await registerUserAndGetToken({
      email: buildUniqueEmail('e2e-saved-del-seller'),
      username: 'savdels',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buildUniqueEmail('e2e-saved-del-buyer'),
      username: 'savdelb',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Saved Listing Delete',
      description: 'Listing used to verify unsaving functionality.',
    });

    await saveListing({
      accessToken: buyerToken,
      listingId: listing.body.id,
    });

    await request(app.getHttpServer())
      .delete(`/saved-listings/${listing.body.id}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.message).toContain('removed from saved listings');
      });

    return request(app.getHttpServer())
      .get('/saved-listings/mine')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(0);
      });
  });

  it('POST /listings/:listingId/inquiries should create an inquiry for a buyer', async () => {
    const sellerEmail = buildUniqueEmail('e2e-inquiry-seller');
    const buyerEmail = buildUniqueEmail('e2e-inquiry-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inq-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inq-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Inquiry Target Listing',
      description: 'Listing used to verify inquiry creation.',
    });

    const response = await createInquiry({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Can you share the piano serial number?',
    });

    expect(response.body.id).toEqual(expect.any(Number));
    expect(response.body.status).toBe('open');
    expect(response.body.message).toBe('Can you share the piano serial number?');
    expect(response.body.listing).toMatchObject({
      id: listing.body.id,
      title: 'Inquiry Target Listing',
      status: 'active',
    });
    expect(response.body.requester).toMatchObject({
      username: 'inq-buyer',
    });
  });

  it('GET /inquiries/mine should return only the current user inquiries', async () => {
    const sellerEmail = buildUniqueEmail('e2e-inquiries-mine-seller');
    const firstBuyerEmail = buildUniqueEmail('e2e-inquiries-mine-a');
    const secondBuyerEmail = buildUniqueEmail('e2e-inquiries-mine-b');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inqmine-s',
    });
    const firstBuyerToken = await registerUserAndGetToken({
      email: firstBuyerEmail,
      username: 'inqmine-a',
    });
    const secondBuyerToken = await registerUserAndGetToken({
      email: secondBuyerEmail,
      username: 'inqmine-b',
    });

    const firstListing = await createListing({
      accessToken: sellerToken,
      title: 'Inquiry Mine A',
      description: 'Listing used to verify the first buyer inquiry list.',
    });
    const secondListing = await createListing({
      accessToken: sellerToken,
      title: 'Inquiry Mine B',
      description: 'Listing used to verify the second buyer inquiry list.',
    });

    await createInquiry({
      accessToken: firstBuyerToken,
      listingId: firstListing.body.id,
      message: 'First buyer inquiry.',
    });
    await createInquiry({
      accessToken: secondBuyerToken,
      listingId: secondListing.body.id,
      message: 'Second buyer inquiry.',
    });

    return request(app.getHttpServer())
      .get('/inquiries/mine')
      .set('Authorization', `Bearer ${firstBuyerToken}`)
      .expect(200)
      .expect((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          message: 'First buyer inquiry.',
          status: 'open',
          listing: {
            title: 'Inquiry Mine A',
          },
        });
      });
  });

  it('GET /listings/:listingId/inquiries should return inquiries to the listing owner', async () => {
    const sellerEmail = buildUniqueEmail('e2e-inquiry-view-seller');
    const buyerEmail = buildUniqueEmail('e2e-inquiry-view-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inqview-s',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inqview-b',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Seller Inquiry Inbox',
      description: 'Listing used to verify seller inquiry visibility.',
    });

    await createInquiry({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Can you share when it was last serviced?',
    });

    return request(app.getHttpServer())
      .get(`/listings/${listing.body.id}/inquiries`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200)
      .expect((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          status: 'open',
          message: 'Can you share when it was last serviced?',
          requester: {
            username: 'inqview-b',
          },
        });
      });
  });

  it('POST /listings/:listingId/inquiries should return 409 for a duplicate inquiry', async () => {
    const sellerEmail = buildUniqueEmail('e2e-duplicate-inquiry-seller');
    const buyerEmail = buildUniqueEmail('e2e-duplicate-inquiry-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inqdup-s',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inqdup-b',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Duplicate Inquiry Target',
      description: 'Listing used to verify duplicate inquiry protection.',
    });

    await createInquiry({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Initial inquiry message.',
    });

    return request(app.getHttpServer())
      .post(`/listings/${listing.body.id}/inquiries`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        message: 'Second inquiry should be rejected.',
      })
      .expect(409);
  });

  it('POST /listings/:listingId/inquiries should return 400 for a sold listing', async () => {
    const sellerEmail = buildUniqueEmail('e2e-sold-inquiry-seller');
    const buyerEmail = buildUniqueEmail('e2e-sold-inquiry-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inqsold-s',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inqsold-b',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Sold Inquiry Target',
      description: 'Listing used to verify sold listings cannot receive inquiries.',
    });

    await request(app.getHttpServer())
      .patch(`/listings/${listing.body.id}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'sold' })
      .expect(200);

    return request(app.getHttpServer())
      .post(`/listings/${listing.body.id}/inquiries`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ message: 'Trying to contact about a sold listing.' })
      .expect(400);
  });

  it('GET /listings/:listingId/inquiries should return 403 for a non-owner', async () => {
    const sellerEmail = buildUniqueEmail('e2e-inquiry-owner-seller');
    const buyerEmail = buildUniqueEmail('e2e-inquiry-owner-buyer');
    const outsiderEmail = buildUniqueEmail('e2e-inquiry-owner-outsider');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inqown-s',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inqown-b',
    });
    const outsiderToken = await registerUserAndGetToken({
      email: outsiderEmail,
      username: 'inqown-o',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Owner Only Inquiry View',
      description: 'Listing used to verify seller-only inquiry visibility.',
    });

    await createInquiry({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Valid inquiry before outsider access attempt.',
    });

    return request(app.getHttpServer())
      .get(`/listings/${listing.body.id}/inquiries`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('PATCH /inquiries/:id/status should allow the seller to close an open inquiry', async () => {
    const sellerEmail = buildUniqueEmail('e2e-inquiry-close-seller');
    const buyerEmail = buildUniqueEmail('e2e-inquiry-close-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inqcls-s',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inqcls-b',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Close Inquiry Listing',
      description: 'Listing used to verify seller inquiry closing.',
    });

    const inquiry = await createInquiry({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Please let me know if this is still available.',
    });

    return updateInquiryStatus({
      accessToken: sellerToken,
      inquiryId: inquiry.body.id,
      status: 'closed',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('closed');
      expect(response.body.listing).toMatchObject({
        id: listing.body.id,
        title: 'Close Inquiry Listing',
      });
    });
  });

  it('PATCH /inquiries/:id/status should allow the requester to close their own inquiry', async () => {
    const sellerEmail = buildUniqueEmail('e2e-inquiry-close-own-seller');
    const buyerEmail = buildUniqueEmail('e2e-inquiry-close-own-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inqclo-s',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inqclo-b',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Requester Close Inquiry Listing',
      description: 'Listing used to verify buyer inquiry closing.',
    });

    const inquiry = await createInquiry({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'I may not need this anymore.',
    });

    return updateInquiryStatus({
      accessToken: buyerToken,
      inquiryId: inquiry.body.id,
      status: 'closed',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('closed');
      expect(response.body.requester).toMatchObject({
        username: 'inqclo-b',
      });
    });
  });

  it('PATCH /inquiries/:id/status should return 403 for a user who is not part of the inquiry', async () => {
    const sellerEmail = buildUniqueEmail('e2e-inquiry-third-seller');
    const buyerEmail = buildUniqueEmail('e2e-inquiry-third-buyer');
    const outsiderEmail = buildUniqueEmail('e2e-inquiry-third-outsider');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inq3rd-s',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inq3rd-b',
    });
    const outsiderToken = await registerUserAndGetToken({
      email: outsiderEmail,
      username: 'inq3rd-o',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Third Party Inquiry Listing',
      description: 'Listing used to verify outsider inquiry status changes are forbidden.',
    });

    const inquiry = await createInquiry({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Inquiry before outsider update attempt.',
    });

    return updateInquiryStatus({
      accessToken: outsiderToken,
      inquiryId: inquiry.body.id,
      status: 'closed',
    }).then((response) => {
      expect(response.status).toBe(403);
    });
  });

  it('PATCH /inquiries/:id/status should return 400 when trying to reopen an inquiry', async () => {
    const sellerEmail = buildUniqueEmail('e2e-inquiry-reopen-seller');
    const buyerEmail = buildUniqueEmail('e2e-inquiry-reopen-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inqrop-s',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inqrop-b',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Reopen Inquiry Listing',
      description: 'Listing used to verify inquiries cannot be reopened.',
    });

    const inquiry = await createInquiry({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Inquiry before invalid reopen attempt.',
    });

    return updateInquiryStatus({
      accessToken: sellerToken,
      inquiryId: inquiry.body.id,
      status: 'open',
    }).then((response) => {
      expect(response.status).toBe(400);
    });
  });

  it('PATCH /inquiries/:id/status should return 400 when changing a closed inquiry again', async () => {
    const sellerEmail = buildUniqueEmail('e2e-inquiry-terminal-seller');
    const buyerEmail = buildUniqueEmail('e2e-inquiry-terminal-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'inqter-s',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'inqter-b',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Terminal Inquiry Listing',
      description: 'Listing used to verify closed inquiries cannot be changed again.',
    });

    const inquiry = await createInquiry({
      accessToken: buyerToken,
      listingId: listing.body.id,
      message: 'Inquiry before terminal status validation.',
    });

    await updateInquiryStatus({
      accessToken: sellerToken,
      inquiryId: inquiry.body.id,
      status: 'closed',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    return updateInquiryStatus({
      accessToken: buyerToken,
      inquiryId: inquiry.body.id,
      status: 'closed',
    }).then((response) => {
      expect(response.status).toBe(400);
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

  it('POST /listings/:listingId/bookings should return 400 for a sold listing', async () => {
    const sellerEmail = buildUniqueEmail('e2e-sold-booking-seller');
    const buyerEmail = buildUniqueEmail('e2e-sold-booking-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'sold-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'sold-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Sold Booking Target',
      description: 'Listing used to verify sold listings no longer accept bookings.',
    });

    await request(app.getHttpServer())
      .patch(`/listings/${listing.body.id}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'sold' })
      .expect(200);

    return request(app.getHttpServer())
      .post(`/listings/${listing.body.id}/bookings`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ message: 'Trying to book a sold listing.' })
      .expect(400);
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

  it('POST /listings/:listingId/transactions should create a transaction for a valid buyer', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Transaction Target Listing',
      description: 'Listing used to verify transaction creation.',
      price: 3500,
    });

    const response = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3400,
      message: 'Happy to proceed at this offer price.',
    });

    expect(response.body).toMatchObject({
      listingId: listing.body.id,
      buyerId: expect.any(Number),
      offeredPrice: 3400,
      status: 'initiated',
      buyer: { username: 'txn-buyer' },
      listing: {
        title: 'Transaction Target Listing',
        owner: { username: 'txn-seller' },
      },
    });
  });

  it('GET /transactions/mine should return only the current buyer transactions', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-mine-seller');
    const buyerAEmail = buildUniqueEmail('e2e-transaction-mine-a');
    const buyerBEmail = buildUniqueEmail('e2e-transaction-mine-b');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-mine-seller',
    });
    const buyerAToken = await registerUserAndGetToken({
      email: buyerAEmail,
      username: 'txn-buyer-a',
    });
    const buyerBToken = await registerUserAndGetToken({
      email: buyerBEmail,
      username: 'txn-buyer-b',
    });

    const listingA = await createListing({
      accessToken: sellerToken,
      title: 'Buyer A Transaction Target',
      description: 'Used to check buyer transaction filtering.',
    });
    const listingB = await createListing({
      accessToken: sellerToken,
      title: 'Buyer B Transaction Target',
      description: 'Used to check buyer transaction filtering.',
    });

    await createTransaction({
      accessToken: buyerAToken,
      listingId: listingA.body.id,
      offeredPrice: 3000,
      message: 'Buyer A transaction.',
    });
    await createTransaction({
      accessToken: buyerBToken,
      listingId: listingB.body.id,
      offeredPrice: 3100,
      message: 'Buyer B transaction.',
    });

    return request(app.getHttpServer())
      .get('/transactions/mine')
      .set('Authorization', `Bearer ${buyerAToken}`)
      .expect(200)
      .expect((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          message: 'Buyer A transaction.',
          status: 'initiated',
          listing: {
            title: 'Buyer A Transaction Target',
          },
        });
      });
  });

  it('GET /listings/:listingId/transactions should return transactions to the listing owner', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-view-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-view-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-view-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-view-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Seller Transaction View',
      description: 'Listing used to verify seller transaction visibility.',
    });

    await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3300,
      message: 'Can move quickly at this price.',
    });

    return request(app.getHttpServer())
      .get(`/listings/${listing.body.id}/transactions`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200)
      .expect((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          offeredPrice: 3300,
          status: 'initiated',
          buyer: {
            username: 'txn-view-buyer',
          },
        });
      });
  });

  it('POST /listings/:listingId/transactions should return 409 for a duplicate transaction', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-dup-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-dup-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-dup-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-dup-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Duplicate Transaction Target',
      description: 'Listing used to verify duplicate transaction protection.',
    });

    await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3200,
    });

    return request(app.getHttpServer())
      .post(`/listings/${listing.body.id}/transactions`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        offeredPrice: 3250,
        message: 'Second transaction attempt.',
      })
      .expect(409);
  });

  it('POST /listings/:listingId/transactions should allow a new transaction after the previous one is cancelled', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-restart-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-restart-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-restart-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-restart-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Restart Transaction Target',
      description: 'Listing used to verify a new transaction can start after cancellation.',
    });

    const firstTransaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3400,
      message: 'First transaction attempt.',
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: firstTransaction.body.id,
      status: 'seller_accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    const firstPayment = await createPayment({
      accessToken: buyerToken,
      transactionId: firstTransaction.body.id,
      amount: 3400,
    });

    await simulatePayment({
      accessToken: buyerToken,
      paymentId: firstPayment.body.id,
      status: 'paid',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('paid');
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: firstTransaction.body.id,
      status: 'cancelled',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
    });

    return request(app.getHttpServer())
      .post(`/listings/${listing.body.id}/transactions`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        offeredPrice: 3450,
        message: 'Starting a replacement transaction after the previous one was cancelled.',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.id).not.toBe(firstTransaction.body.id);
        expect(response.body.status).toBe('initiated');
        expect(response.body.offeredPrice).toBe(3450);
      });
  });

  it('POST /listings/:listingId/transactions should return 400 for your own listing', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-own');
    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-own-seller',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Own Transaction Target',
      description: 'Listing used to verify owners cannot start their own transaction.',
    });

    return request(app.getHttpServer())
      .post(`/listings/${listing.body.id}/transactions`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        offeredPrice: 3000,
        message: 'Trying to transact on my own listing.',
      })
      .expect(400);
  });

  it('PATCH /transactions/:id/status should allow the seller to accept an initiated transaction', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-accept-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-accept-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-acc-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-acc-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Accept Transaction Listing',
      description: 'Listing used to verify seller acceptance of a transaction.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3300,
    });

    return updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'seller_accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('seller_accepted');
      expect(response.body.expiresAt).toEqual(expect.any(String));
    });
  });

  it('PATCH /transactions/:id/status should allow the buyer to confirm a seller-accepted transaction', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-confirm-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-confirm-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-conf-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-conf-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Confirm Transaction Listing',
      description: 'Listing used to verify buyer confirmation of a transaction.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3400,
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'seller_accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    return updateTransactionStatus({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      status: 'buyer_confirmed',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('buyer_confirmed');
    });
  });

  it('PATCH /transactions/:id/status should mark the listing as sold when the seller completes it', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-complete-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-complete-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-comp-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-comp-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Complete Transaction Listing',
      description: 'Listing used to verify completion marks the listing as sold.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3450,
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'seller_accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    await updateTransactionStatus({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      status: 'buyer_confirmed',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    const payment = await createPayment({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      amount: 3450,
    });

    await simulatePayment({
      accessToken: buyerToken,
      paymentId: payment.body.id,
      status: 'paid',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('paid');
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'completed',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
      expect(response.body.listing.status).toBe('sold');
    });

    return request(app.getHttpServer())
      .get(`/listings/${listing.body.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('sold');
      });
  });

  it('PATCH /transactions/:id/status should return 400 when no paid payment exists yet', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-no-payment-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-no-payment-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-pay-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-pay-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Payment Required Transaction Listing',
      description: 'Listing used to verify completion now requires a paid payment.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3300,
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'seller_accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    await updateTransactionStatus({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      status: 'buyer_confirmed',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    return updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'completed',
    }).then((response) => {
      expect(response.status).toBe(400);
    });
  });

  it('POST /transactions/:transactionId/payments should create a simulated payment for the buyer', async () => {
    const sellerEmail = buildUniqueEmail('e2e-payment-create-seller');
    const buyerEmail = buildUniqueEmail('e2e-payment-create-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'pay-create-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'pay-create-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Payment Create Listing',
      description: 'Listing used to verify simulated payment creation.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3250,
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'seller_accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    const payment = await createPayment({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      amount: 3250,
      providerPaymentId: 'sim-pay-001',
    });

    expect(payment.body).toMatchObject({
      transactionId: transaction.body.id,
      buyerId: expect.any(Number),
      amount: 3250,
      provider: 'simulated',
      providerPaymentId: 'sim-pay-001',
      status: 'pending',
    });
  });

  it('GET /payments/mine should return only the current buyer payments', async () => {
    const sellerEmail = buildUniqueEmail('e2e-payment-mine-seller');
    const buyerAEmail = buildUniqueEmail('e2e-payment-mine-a');
    const buyerBEmail = buildUniqueEmail('e2e-payment-mine-b');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'pay-mine-seller',
    });
    const buyerAToken = await registerUserAndGetToken({
      email: buyerAEmail,
      username: 'pay-mine-a',
    });
    const buyerBToken = await registerUserAndGetToken({
      email: buyerBEmail,
      username: 'pay-mine-b',
    });

    const listingA = await createListing({
      accessToken: sellerToken,
      title: 'Payment Mine Listing A',
      description: 'First payment listing for buyer filtering.',
    });
    const listingB = await createListing({
      accessToken: sellerToken,
      title: 'Payment Mine Listing B',
      description: 'Second payment listing for buyer filtering.',
    });

    const transactionA = await createTransaction({
      accessToken: buyerAToken,
      listingId: listingA.body.id,
      offeredPrice: 3000,
    });
    const transactionB = await createTransaction({
      accessToken: buyerBToken,
      listingId: listingB.body.id,
      offeredPrice: 3100,
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transactionA.body.id,
      status: 'seller_accepted',
    });
    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transactionB.body.id,
      status: 'seller_accepted',
    });

    await createPayment({
      accessToken: buyerAToken,
      transactionId: transactionA.body.id,
      amount: 3000,
    });
    await createPayment({
      accessToken: buyerBToken,
      transactionId: transactionB.body.id,
      amount: 3100,
    });

    return request(app.getHttpServer())
      .get('/payments/mine')
      .set('Authorization', `Bearer ${buyerAToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          amount: 3000,
          transaction: {
            listing: {
              title: 'Payment Mine Listing A',
            },
          },
        });
      });
  });

  it('GET /transactions/:transactionId/payments should return payments to a transaction party', async () => {
    const sellerEmail = buildUniqueEmail('e2e-payment-view-seller');
    const buyerEmail = buildUniqueEmail('e2e-payment-view-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'pay-view-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'pay-view-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Payment View Listing',
      description: 'Listing used to verify transaction payment visibility.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3150,
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'seller_accepted',
    });

    await createPayment({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      amount: 3150,
    });

    return request(app.getHttpServer())
      .get(`/transactions/${transaction.body.id}/payments`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          amount: 3150,
          status: 'pending',
        });
      });
  });

  it('PATCH /payments/:id/simulate should allow the buyer to mark a payment as paid', async () => {
    const sellerEmail = buildUniqueEmail('e2e-payment-paid-seller');
    const buyerEmail = buildUniqueEmail('e2e-payment-paid-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'pay-paid-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'pay-paid-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Payment Simulate Listing',
      description: 'Listing used to verify simulated payment success.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3220,
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'seller_accepted',
    });

    const payment = await createPayment({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      amount: 3220,
    });

    return simulatePayment({
      accessToken: buyerToken,
      paymentId: payment.body.id,
      status: 'paid',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('paid');
      expect(response.body.paidAt).toEqual(expect.any(String));
    });
  });

  it('PATCH /transactions/:id/status should close competing deal flows when a transaction completes', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-closeflows-seller');
    const winningBuyerEmail = buildUniqueEmail('e2e-transaction-closeflows-win');
    const otherBuyerEmail = buildUniqueEmail('e2e-transaction-closeflows-other');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-flow-seller',
    });
    const winningBuyerToken = await registerUserAndGetToken({
      email: winningBuyerEmail,
      username: 'txn-flow-win',
    });
    const otherBuyerToken = await registerUserAndGetToken({
      email: otherBuyerEmail,
      username: 'txn-flow-other',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Close Competing Deal Flows Listing',
      description: 'Listing used to verify competing deal flows are closed after completion.',
    });

    const winningTransaction = await createTransaction({
      accessToken: winningBuyerToken,
      listingId: listing.body.id,
      offeredPrice: 3600,
      message: 'Winning buyer offer.',
    });

    const competingTransaction = await createTransaction({
      accessToken: otherBuyerToken,
      listingId: listing.body.id,
      offeredPrice: 3550,
      message: 'Competing buyer offer.',
    });

    const competingBooking = await createBooking({
      accessToken: otherBuyerToken,
      listingId: listing.body.id,
      message: 'Competing buyer booking.',
    });

    const competingInquiry = await createInquiry({
      accessToken: otherBuyerToken,
      listingId: listing.body.id,
      message: 'Competing buyer inquiry.',
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: winningTransaction.body.id,
      status: 'seller_accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    await updateTransactionStatus({
      accessToken: winningBuyerToken,
      transactionId: winningTransaction.body.id,
      status: 'buyer_confirmed',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    const payment = await createPayment({
      accessToken: winningBuyerToken,
      transactionId: winningTransaction.body.id,
      amount: 3600,
    });

    await simulatePayment({
      accessToken: winningBuyerToken,
      paymentId: payment.body.id,
      status: 'paid',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: winningTransaction.body.id,
      status: 'completed',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    await request(app.getHttpServer())
      .get(`/listings/${listing.body.id}/transactions`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200)
      .expect((response) => {
        const loser = response.body.find(
          (transaction: { id: number }) => transaction.id === competingTransaction.body.id,
        );
        expect(loser).toMatchObject({
          status: 'cancelled',
        });
      });

    await request(app.getHttpServer())
      .get(`/listings/${listing.body.id}/bookings`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200)
      .expect((response) => {
        const booking = response.body.find(
          (item: { id: number }) => item.id === competingBooking.body.id,
        );
        expect(booking).toMatchObject({
          status: 'rejected',
        });
      });

    return request(app.getHttpServer())
      .get('/inquiries/mine')
      .set('Authorization', `Bearer ${otherBuyerToken}`)
      .expect(200)
      .expect((response) => {
        const inquiry = response.body.find(
          (item: { id: number }) => item.id === competingInquiry.body.id,
        );
        expect(inquiry).toMatchObject({
          status: 'closed',
        });
      });
  });

  it('PATCH /transactions/:id/status should allow cancelling a non-terminal transaction', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-cancel-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-cancel-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-can-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-can-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Cancel Transaction Listing',
      description: 'Listing used to verify cancelling a transaction.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3350,
    });

    return updateTransactionStatus({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      status: 'cancelled',
    }).then((response) => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
    });
  });

  it('PATCH /transactions/:id/status should return 400 for an invalid transition', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-invalid-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-invalid-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-inv-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-inv-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Invalid Transaction Transition',
      description: 'Listing used to verify invalid transaction transitions.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3200,
    });

    return updateTransactionStatus({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      status: 'buyer_confirmed',
    }).then((response) => {
      expect(response.status).toBe(400);
    });
  });

  it('GET /transactions/mine should auto-release expired seller-accepted transactions', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-expire-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-expire-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-exp-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-exp-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Expire Transaction Listing',
      description: 'Listing used to verify expired accepted transactions are released.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3150,
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'seller_accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    await prismaService.prisma.transaction.update({
      where: { id: transaction.body.id },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    return request(app.getHttpServer())
      .get('/transactions/mine')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toMatchObject({
          id: transaction.body.id,
          status: 'cancelled',
        });
      });
  });

  it('PATCH /transactions/:id/status should return 400 when a seller-accepted transaction has expired', async () => {
    const sellerEmail = buildUniqueEmail('e2e-transaction-expire-update-seller');
    const buyerEmail = buildUniqueEmail('e2e-transaction-expire-update-buyer');

    const sellerToken = await registerUserAndGetToken({
      email: sellerEmail,
      username: 'txn-exu-seller',
    });
    const buyerToken = await registerUserAndGetToken({
      email: buyerEmail,
      username: 'txn-exu-buyer',
    });

    const listing = await createListing({
      accessToken: sellerToken,
      title: 'Expired Update Transaction Listing',
      description: 'Listing used to verify expired transactions cannot continue.',
    });

    const transaction = await createTransaction({
      accessToken: buyerToken,
      listingId: listing.body.id,
      offeredPrice: 3180,
    });

    await updateTransactionStatus({
      accessToken: sellerToken,
      transactionId: transaction.body.id,
      status: 'seller_accepted',
    }).then((response) => {
      expect(response.status).toBe(200);
    });

    await prismaService.prisma.transaction.update({
      where: { id: transaction.body.id },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    await updateTransactionStatus({
      accessToken: buyerToken,
      transactionId: transaction.body.id,
      status: 'buyer_confirmed',
    }).then((response) => {
      expect(response.status).toBe(400);
    });

    return request(app.getHttpServer())
      .get('/transactions/mine')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body[0]).toMatchObject({
          id: transaction.body.id,
          status: 'cancelled',
        });
      });
  });
});
