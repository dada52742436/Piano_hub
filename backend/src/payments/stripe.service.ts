import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

interface CreateStripeCheckoutSessionInput {
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  listingTitle: string;
  paymentId: number;
  transactionId: number;
  buyerEmail?: string | null;
}

@Injectable()
export class StripeService {
  // Cache the Stripe client so we don't re-instantiate it on every request.
  private readonly client: Stripe;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      throw new InternalServerErrorException('STRIPE_SECRET_KEY is not configured');
    }

    this.client = new Stripe(secretKey);
  }

  async createCheckoutSession(input: CreateStripeCheckoutSessionInput) {
    return this.client.checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.buyerEmail ?? undefined,
      metadata: {
        paymentId: String(input.paymentId),
        transactionId: String(input.transactionId),
      },
      payment_intent_data: {
        metadata: {
          paymentId: String(input.paymentId),
          transactionId: String(input.transactionId),
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.amountCents,
            product_data: {
              name: input.listingTitle,
            },
          },
        },
      ],
    });
  }

  async createRefund(paymentIntentId: string): Promise<Stripe.Refund> {
    return this.client.refunds.create({ payment_intent: paymentIntentId });
  }

  constructWebhookEvent(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new InternalServerErrorException(
        'STRIPE_WEBHOOK_SECRET is not configured',
      );
    }

    try {
      // Use the cached client to verify the webhook signature.
      return this.client.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }
}
