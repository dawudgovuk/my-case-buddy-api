import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import crypto from 'crypto';
import { INVITE_TTL_MS } from '../../../lib/config/app-config';
import { CaseMembership } from '../../../lib/cases/case-membership';
import type { CaseInviteRecord, EntityId } from '../../../lib/domain/models';
import type { ProfessionalRole } from '../../../lib/domain/roles';
import { UserRepository } from '../../../lib/users/user-repository';

const { ValidationError, NotFoundError } = errors;

/** Expiry timestamp for a new invite. */
export function inviteExpiry(from: Date = new Date()): string {
  return new Date(from.getTime() + INVITE_TTL_MS).toISOString();
}

export default factories.createCoreService('api::case-invite.case-invite', ({ strapi }) => {
  const users = new UserRepository(strapi);
  const membership = new CaseMembership(strapi);

  async function findByToken(token: string): Promise<CaseInviteRecord | undefined> {
    const invites = (await strapi.documents('api::case-invite.case-invite').findMany({
      filters: { token: { $eq: token } },
      populate: { case: { populate: { owner: true, members: true } } },
    })) as unknown as CaseInviteRecord[];
    return invites?.[0];
  }

  /** Throws when the invite is missing, already used or expired. */
  function assertRedeemable(invite: CaseInviteRecord | undefined): asserts invite is CaseInviteRecord {
    if (!invite) throw new NotFoundError('Invalid invite token');
    if (invite.usedAt) throw new ValidationError('This invite token has already been redeemed');
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new ValidationError('This invite token has expired');
    }
  }

  return {
    /** Creates an invite with a random token that expires after 30 days. */
    async createInvite(caseDocumentId: string, role: ProfessionalRole, createdById: number | string) {
      return strapi.documents('api::case-invite.case-invite').create({
        data: {
          token: crypto.randomUUID(),
          role,
          case: caseDocumentId,
          createdBy: createdById,
          expiresAt: inviteExpiry(),
        },
      });
    },

    /** Redeems an invite: marks it used and adds the user to the case as a supporter. */
    async acceptInvite(token: string, userId: EntityId) {
      if (!token) throw new ValidationError('Invite token is required');

      const invite = await findByToken(token);
      assertRedeemable(invite);

      const user = await users.findById(userId);
      if (!user) throw new NotFoundError('User not found');

      await strapi.documents('api::case-invite.case-invite').update({
        documentId: invite.documentId,
        data: { usedAt: new Date().toISOString(), usedBy: user.id },
      });

      const caseRecord = invite.case;
      if (caseRecord?.documentId) {
        await membership.addSupporter(caseRecord, user.id, '[AcceptInvite] Direct link insertion note:');
        await membership.announceSupporter(
          caseRecord,
          user,
          user.name || user.username || 'Legal Professional',
          user.userRole || invite.role || 'Peer Supporter',
          '[AcceptInvite]'
        );
      }

      return {
        success: true,
        case: caseRecord,
        role: invite.role,
        user: { id: user.id, email: user.email, name: user.name || user.username, role: user.userRole },
      };
    },
  };
});
