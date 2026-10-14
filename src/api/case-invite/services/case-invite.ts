import { factories } from '@strapi/strapi';
import crypto from 'crypto';
import { errors } from '@strapi/utils';

const { ValidationError, NotFoundError } = errors;

export default factories.createCoreService('api::case-invite.case-invite', ({ strapi }) => ({
  /**
   * Create an invitation with a cryptographically secure token and 30-day expiration (SOLID - SRP)
   */
  async createInvite(caseDocumentId: string, role: 'McKenzieFriend' | 'Solicitor' | 'Barrister', createdById: number | string) {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    return strapi.documents('api::case-invite.case-invite').create({
      data: {
        token,
        role,
        case: caseDocumentId,
        createdBy: createdById,
        expiresAt: expiresAt.toISOString(),
      },
    });
  },

  /**
   * Validate and accept an invitation token (SOLID - SRP)
   */
  async acceptInvite(token: string, userId: number | string) {
    if (!token) {
      throw new ValidationError('Invite token is required');
    }

    const invites = await strapi.documents('api::case-invite.case-invite').findMany({
      filters: { token: { $eq: token } },
      populate: { case: true },
    });

    if (!invites || invites.length === 0) {
      throw new NotFoundError('Invalid invite token');
    }

    const invite = invites[0];

    if (invite.usedAt) {
      throw new ValidationError('This invite token has already been redeemed');
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new ValidationError('This invite token has expired');
    }

    // Mark invite as redeemed
    await strapi.documents('api::case-invite.case-invite').update({
      documentId: invite.documentId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        usedAt: new Date().toISOString(),
        usedBy: userId,
      } as any,
    });

    // Add accepting user as an authorized member of the case (FPR Multi-Tenant Security)
    const caseDoc = invite.case as { documentId?: string } | undefined;
    if (caseDoc?.documentId) {
      await strapi.documents('api::case.case').update({
        documentId: caseDoc.documentId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          members: {
            connect: [userId],
          },
        } as any,
      });
    }

    return {
      success: true,
      case: invite.case,
      role: invite.role,
    };
  },
}));
