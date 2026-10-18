import type { Core } from '@strapi/strapi';
import type { UserRole } from '../../../lib/domain/roles';

export interface ClerkEmailAddress {
  email_address: string;
  verification?: { status?: string };
}

export interface ClerkUserData {
  id: string;
  first_name?: string;
  last_name?: string;
  email_addresses?: ClerkEmailAddress[];
  public_metadata?: {
    role?: UserRole;
    subscriptionTier?: 'free' | 'standard' | 'premium' | 'professional';
    subscriptionStatus?: string;
    firm?: string;
    registrationNumber?: string;
  };
}

interface ClerkLinkedUser {
  documentId: string;
  userRole?: string | null;
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  firm?: string | null;
  registrationNumber?: string | null;
}

const USER_UID = 'plugin::users-permissions.user';

/** Primary email of a Clerk user, or a placeholder derived from the Clerk id. */
export function clerkEmail(data: ClerkUserData): string {
  return data.email_addresses?.[0]?.email_address || `${data.id}@clerk.user`;
}

export function clerkDisplayName(data: ClerkUserData): string {
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || clerkEmail(data);
}

/** Mirrors Clerk users into users-permissions, keyed by `clerkId`. */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  const users = () => strapi.documents(USER_UID);

  async function findLinkedUser(clerkId: string): Promise<ClerkLinkedUser | undefined> {
    const found = (await users().findMany({ filters: { clerkId: { $eq: clerkId } } })) as unknown as ClerkLinkedUser[];
    return found[0];
  }

  return {
    /** Applies a Clerk user event. Unknown event types are ignored. */
    async handleEvent(type: string, data: ClerkUserData): Promise<void> {
      if (type === 'user.created') await this.onUserCreated(data);
      else if (type === 'user.updated') await this.onUserUpdated(data);
    },

    async onUserCreated(data: ClerkUserData): Promise<void> {
      if (await findLinkedUser(data.id)) return;
      const email = clerkEmail(data);
      const metadata = data.public_metadata || {};
      await users().create({
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
    },

    async onUserUpdated(data: ClerkUserData): Promise<void> {
      const existing = await findLinkedUser(data.id);
      if (!existing) return;
      const metadata = data.public_metadata || {};
      const update = users().update as (params: { documentId: string; data: Record<string, unknown> }) => Promise<unknown>;
      await update({
        documentId: existing.documentId,
        data: {
          email: clerkEmail(data),
          userRole: metadata.role || existing.userRole || 'LIP',
          subscriptionTier: metadata.subscriptionTier || existing.subscriptionTier || 'free',
          subscriptionStatus: metadata.subscriptionStatus || existing.subscriptionStatus || 'active',
          firm: metadata.firm ?? existing.firm,
          registrationNumber: metadata.registrationNumber ?? existing.registrationNumber,
        },
      });
    },
  };
};
