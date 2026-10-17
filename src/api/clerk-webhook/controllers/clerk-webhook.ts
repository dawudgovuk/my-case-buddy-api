import type { Core } from '@strapi/strapi';
import { clerkDisplayName, type ClerkUserData } from '../services/clerk-webhook';

interface ClerkWebhookPayload {
  type: string;
  data: ClerkUserData;
}

interface WebhookContext {
  request: { body: ClerkWebhookPayload };
  send: (body: unknown) => void;
  badRequest: (msg: string) => void;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /** POST /api/clerk-webhook: keeps Strapi users in step with Clerk. */
  async handleWebhook(ctx: WebhookContext) {
    const { type, data } = ctx.request.body || {};
    if (!type || !data?.id) {
      return ctx.badRequest('Missing event type or user ID from Clerk webhook');
    }

    try {
      await strapi.service('api::clerk-webhook.clerk-webhook').handleEvent(type, data);
      return ctx.send({ received: true, event: type, userId: data.id, name: clerkDisplayName(data) });
    } catch (err: unknown) {
      strapi.log.error('Clerk webhook processing error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return ctx.badRequest(`Webhook handling failed: ${message}`);
    }
  },
});
