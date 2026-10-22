import type { Core } from '@strapi/strapi';
import { AppConfig, INVITE_TTL_MS } from '../../../lib/config/app-config';
import { FULL_CASE_POPULATE } from '../../../lib/cases/case-populate';
import { CaseAuditLog } from '../../../lib/cases/case-audit-log';
import { CaseMembership } from '../../../lib/cases/case-membership';
import type { AppUser, CaseRecord } from '../../../lib/domain/models';
import { isProfessionalRole } from '../../../lib/domain/roles';
import { Mailer } from '../../../lib/email/mailer';
import { TemplateService } from '../../../lib/email/template-service';
import {
  PeerSupportConfirmationEmail,
  PeerSupportRequestEmail,
} from '../../../lib/email/templates/peer-support-templates';
import { UserRepository } from '../../../lib/users/user-repository';

const SENDER_NAME = 'My Case Buddy Legal Support';

export interface PeerSupportRequestInput {
  caseDocumentId: string;
  user: AppUser | null;
  /** Email from the X-User-Email header, used when the caller has no Strapi session. */
  headerEmail?: string;
  targetUserId?: string;
  note?: string;
}

export type AcceptResult =
  | { status: 'unauthorized'; message: string }
  | { status: 'forbidden'; message: string }
  | { status: 'not-found'; message: string }
  | { status: 'accepted'; caseRecord: CaseRecord; user: AppUser };

/**
 * Peer support workflow: a litigant asks for help (optionally from a chosen supporter) and a
 * legal professional accepts. Notifications are best-effort: email failures are logged only.
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  const users = new UserRepository(strapi);
  const membership = new CaseMembership(strapi);
  const audit = new CaseAuditLog(strapi);
  const mailer = new Mailer(strapi);

  async function loadCase(documentId: string, populate: Record<string, boolean>): Promise<CaseRecord | null> {
    return (await strapi.documents('api::case.case').findOne({ documentId, populate })) as unknown as CaseRecord | null;
  }

  return {
    async request(input: PeerSupportRequestInput) {
      const { caseDocumentId, user, headerEmail, targetUserId, note } = input;

      if (user && user.role?.type !== 'admin') {
        const isOwner = await strapi.service('api::case.case').isUserCaseOwner(caseDocumentId, user.id);
        if (!isOwner) {
          strapi.log.info(`[PeerSupport] User ${user.email} (id: ${user.id}) requesting peer support on case ${caseDocumentId}`);
        }
      }

      const targetPro = targetUserId ? await users.findByAnyIdentifier(targetUserId) : null;
      const helpNote = note && note.trim().length > 0 ? note.trim() : 'Peer support requested from verified legal directory';

      await strapi.documents('api::case.case').update({
        documentId: caseDocumentId,
        data: { seekingPeerSupport: true, peerSupportNote: helpNote, peerSupportRequestedAt: new Date().toISOString() },
      });

      const caseRecord = await loadCase(caseDocumentId, FULL_CASE_POPULATE);
      const proName = targetPro?.name || targetPro?.username || 'Legal Supporter';
      const proRole = targetPro?.userRole || 'Professional';
      const lipName = user?.name || user?.username || 'Litigant in Person';
      const lipEmail = user?.email || headerEmail || 'lip@mycasebuddy.justice.gov.uk';

      await audit.addNote(caseDocumentId, lipName, `Peer support requested from ${proName} (${proRole}). Help requested: ${helpNote}`);

      // An invitation is issued only when the chosen supporter's role is known.
      let inviteRecord: unknown = null;
      let inviteToken = '';
      if (targetPro?.userRole) {
        inviteToken = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        inviteRecord = await strapi.documents('api::case-invite.case-invite').create({
          data: {
            token: inviteToken,
            role: targetPro.userRole as 'McKenzieFriend' | 'Solicitor' | 'Barrister',
            case: caseDocumentId,
            expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
          },
        });
      }

      let emailDispatched = false;
      try {
        if (mailer.isAvailable()) {
          const templateService = new TemplateService(strapi);
          const frontendUrl = AppConfig.frontendUrl();
          const summary = {
            caseNumber: caseRecord?.caseNumber || 'FC-2026',
            caseTitle: caseRecord?.title || 'Family Court Matter',
            court: caseRecord?.court || 'Family Court',
            caseType: caseRecord?.caseType || 'Private Law (Child Arrangements)',
            stage: caseRecord?.currentStage || 'Proceedings Active',
          };

          if (targetPro?.email) {
            const reqData = {
              ...summary,
              proName,
              lipName,
              lipEmail,
              helpNote,
              frontendUrl,
              actionUrl: inviteToken ? `${frontendUrl}/invite/${inviteToken}` : `${frontendUrl}/professional-dashboard`,
            };
            const rendered = await templateService.renderTemplate('peer_support_request', reqData, 'en');
            await mailer.send({
              senderName: rendered.senderName || SENDER_NAME,
              replyTo: lipEmail,
              to: targetPro.email,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
            });
            strapi.log.info(`[PeerSupport] Sent notification email to legal supporter: ${targetPro.email}`);
            emailDispatched = true;
          }

          if (lipEmail && lipEmail.includes('@')) {
            const confData = {
              lipName,
              proName,
              proRole,
              proFirm: targetPro?.firm || '',
              proRegistration: targetPro?.registrationNumber || '',
              caseTitle: summary.caseTitle,
              caseNumber: summary.caseNumber,
              helpNote,
              frontendUrl,
            };
            const rendered = await templateService.renderTemplate('peer_support_confirmation', confData, 'en');
            await mailer.send({
              senderName: rendered.senderName || SENDER_NAME,
              replyTo: mailer.fromAddress(),
              to: lipEmail,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
            });
            strapi.log.info(`[PeerSupport] Sent confirmation email copy to requesting LIP: ${lipEmail}`);
            emailDispatched = true;
          }
        }
      } catch (smtpErr: unknown) {
        const emailError = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        strapi.log.warn(`[PeerSupport] SMTP dispatch note: ${emailError}`);
      }

      const updated = await loadCase(caseDocumentId, FULL_CASE_POPULATE);
      return {
        success: true,
        data: updated,
        invite: inviteRecord,
        emailDispatched,
        emailRecipient: targetPro?.email || null,
      };
    },

    async accept(rawCaseId: string, user: AppUser | null): Promise<AcceptResult> {
      if (!user) {
        return { status: 'unauthorized', message: 'Authentication required to accept peer support' };
      }
      if (!isProfessionalRole(user.userRole || '')) {
        return { status: 'forbidden', message: 'Only verified legal professionals can accept peer support requests' };
      }

      const caseDocumentId = (await strapi.service('api::case.case').resolveDocumentId(rawCaseId)) || rawCaseId;
      const caseRecord = await loadCase(caseDocumentId, { owner: true, members: true });
      if (!caseRecord) {
        return { status: 'not-found', message: 'Case not found' };
      }

      await membership.addSupporter(caseRecord, user.id, '[AcceptPeerSupport] Direct link note:');
      await this.markPendingInvitesUsed(caseDocumentId, user.id);
      await membership.announceSupporter(
        caseRecord,
        user,
        user.name || user.username || 'Legal Professional',
        user.userRole || 'Peer Supporter',
        '[AcceptPeerSupport]'
      );
      return { status: 'accepted', caseRecord, user };
    },

    /** Closes every outstanding invite for the case (best-effort). */
    async markPendingInvitesUsed(caseDocumentId: string, userId: number): Promise<void> {
      try {
        const pending = (await strapi.documents('api::case-invite.case-invite').findMany({
          filters: { case: { documentId: { $eq: caseDocumentId } }, usedAt: { $null: true } },
        })) as Array<{ documentId: string }>;
        for (const invite of pending) {
          await strapi.documents('api::case-invite.case-invite').update({
            documentId: invite.documentId,
            data: { usedAt: new Date().toISOString(), usedBy: userId },
          });
        }
      } catch {
        // Non-blocking
      }
    },

  };
};
