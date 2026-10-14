import type { Core } from '@strapi/strapi';

interface ClerkEmailAddress {
  email_address: string;
  verification?: { status?: string };
}

interface ClerkUserData {
  id: string;
  first_name?: string;
  last_name?: string;
  email_addresses?: ClerkEmailAddress[];
  public_metadata?: {
    role?: 'LIP' | 'McKenzieFriend' | 'Solicitor' | 'Barrister';
    subscriptionTier?: 'free' | 'standard' | 'premium' | 'professional';
    subscriptionStatus?: string;
    firm?: string;
    registrationNumber?: string;
  };
}

interface ClerkWebhookPayload {
  type: string;
  data: ClerkUserData;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async handleWebhook(ctx: { request: { body: ClerkWebhookPayload }; send: (body: unknown) => void; badRequest: (msg: string) => void }) {
    const { type, data } = ctx.request.body || {};

    if (!type || !data?.id) {
      return ctx.badRequest('Missing event type or user ID from Clerk webhook');
    }

    const email = data.email_addresses?.[0]?.email_address || `${data.id}@clerk.user`;
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ') || email;
    const metadata = data.public_metadata || {};

    try {
      if (type === 'user.created') {
        const existingUsers = await strapi.documents('plugin::users-permissions.user').findMany({
          filters: { clerkId: { $eq: data.id } },
        });

        if (existingUsers.length === 0) {
          await strapi.documents('plugin::users-permissions.user').create({
            data: {
              username: email,
              email,
              clerkId: data.id,
              confirmed: true,
              blocked: false,
              userRole: metadata.role || 'LIP',
              subscriptionTier: metadata.subscriptionTier || 'free',
              subscriptionStatus: metadata.subscriptionStatus || 'active',
              firm: metadata.firm || undefined,
              registrationNumber: metadata.registrationNumber || undefined,
            },
          });
        }
      } else if (type === 'user.updated') {
        const existingUsers = await strapi.documents('plugin::users-permissions.user').findMany({
          filters: { clerkId: { $eq: data.id } },
        });

        if (existingUsers.length > 0) {
          const userDocId = existingUsers[0].documentId;
          const updateData: Record<string, unknown> = {
            email,
            userRole: metadata.role || existingUsers[0].userRole || 'LIP',
            subscriptionTier: metadata.subscriptionTier || existingUsers[0].subscriptionTier || 'free',
            subscriptionStatus: metadata.subscriptionStatus || existingUsers[0].subscriptionStatus || 'active',
            firm: metadata.firm ?? existingUsers[0].firm,
            registrationNumber: metadata.registrationNumber ?? existingUsers[0].registrationNumber,
          };

          const updateDoc = strapi.documents('plugin::users-permissions.user').update as (
            params: { documentId: string; data: Record<string, unknown> }
          ) => Promise<unknown>;

          await updateDoc({
            documentId: userDocId,
            data: updateData,
          });
        }
      }

      return ctx.send({ received: true, event: type, userId: data.id, name: fullName });
    } catch (err: unknown) {
      strapi.log.error('Clerk webhook processing error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return ctx.badRequest(`Webhook handling failed: ${message}`);
    }
  },
});
