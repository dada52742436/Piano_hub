import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProtectedController } from './protected/protected.controller.js';
import { ListingsModule } from './listings/listings.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { SavedListingsModule } from './saved-listings/saved-listings.module.js';
import { InquiriesModule } from './inquiries/inquiries.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { PaymentsModule } from './payments/payments.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Serve uploaded images at /uploads/** (maps to backend/uploads/ on disk)
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false },
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ListingsModule,  // Listing CRUD module
    BookingsModule,  // Booking lifecycle module
    SavedListingsModule,
    InquiriesModule,
    TransactionsModule,
    PaymentsModule,
  ],
  controllers: [AppController, ProtectedController],
  providers: [AppService],
})
export class AppModule {}
