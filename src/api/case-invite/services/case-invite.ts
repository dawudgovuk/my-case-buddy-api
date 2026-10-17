import { factories } from '@strapi/strapi';
import { renderEmail, esc, paragraph, detailsCard, button } from '../../../utils/email-layout';
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invites: any[] = await strapi.documents('api::case-invite.case-invite').findMany({
      filters: { token: { $eq: token } },
      populate: {
        case: {
          populate: {
            owner: true,
            members: true,
          },
        },
      },
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

    // Lookup accepting user
    const isNum = !isNaN(Number(userId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRecord: any = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: isNum ? { id: Number(userId) } : { documentId: String(userId) },
    });

    if (!userRecord) {
      throw new NotFoundError('User not found');
    }

    // Mark invite as redeemed
    await strapi.documents('api::case-invite.case-invite').update({
      documentId: invite.documentId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        usedAt: new Date().toISOString(),
        usedBy: userRecord.id,
      } as any,
    });

    // Add accepting user as an authorized member of the case (FPR Multi-Tenant Security)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caseDoc = invite.case as any;
    if (caseDoc?.documentId) {
      // 1. Connect member via Strapi Document Service
      await strapi.documents('api::case.case').update({
        documentId: caseDoc.documentId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          members: {
            connect: [userRecord.id],
          },
          seekingPeerSupport: false,
        } as any,
      });

      // 2. Direct SQL link into cases_members_lnk to ensure immediate relational queries succeed
      try {
        const caseId = caseDoc.id;
        const uId = userRecord.id;
        if (caseId && uId) {
          const existing = await strapi.db.connection.raw(
            'SELECT 1 FROM cases_members_lnk WHERE case_id = ? AND user_id = ?',
            [caseId, uId]
          );
          const rows = existing?.rows || existing || [];
          if (rows.length === 0) {
            await strapi.db.connection.raw(
              'INSERT INTO cases_members_lnk (case_id, user_id, user_ord) VALUES (?, ?, ?)',
              [caseId, uId, 1]
            );
          }
        }
      } catch (lnkErr) {
        strapi.log.warn(`[AcceptInvite] Direct link insertion note: ${lnkErr}`);
      }

      // 3. Add an audit case note
      const proName = userRecord.name || userRecord.username || 'Legal Professional';
      const proRole = userRecord.userRole || invite.role || 'Peer Supporter';
      await strapi.documents('api::case-note.case-note').create({
        data: {
          author: `${proName} (${proRole})`,
          text: `Accepted peer support request and joined case as ${proRole}.`,
          case: caseDoc.documentId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });

      // 4. Dispatch Live Notification Email to the Litigant in Person (case owner)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emailService = (strapi as any).plugin('email')?.service('email');
        if (emailService && caseDoc.owner?.email) {
          const ownerEmail = caseDoc.owner.email;
          const ownerName = caseDoc.owner.name || caseDoc.owner.username || 'Litigant in Person';
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const fromEmail = process.env.DEFAULT_FROM_EMAIL || process.env.SMTP_USERNAME || 'aliparvez20@gmail.com';
          const sender = `"My Case Buddy Legal Support" <${fromEmail}>`;

          const acceptHtml = renderEmail({
          title: 'Your peer support request was accepted',
          preheader: `${proName} has accepted your request and joined your case.`,
          tone: 'success',
          eyebrow: 'Good news',
          icon: '&#129309;',
          heroTitle: 'Your request has been accepted',
          heroSubtitle: `${esc(proName)} has joined your case team.`,
          bodyHtml: [
            paragraph(`Dear <strong style="color:#0f172a;">${esc(ownerName)}</strong>,`),
            paragraph(
              `<strong style="color:#0f172a;">${esc(proName)}</strong> (<a href="mailto:${esc(userRecord.email)}" style="color:#0e7a55;">${esc(userRecord.email)}</a>) has accepted your peer support request and can now help with your case.`
            ),
            detailsCard('Case and supporter', [
              { label: 'Case', value: caseDoc.title || 'Family Court Matter' },
              { label: 'Reference', value: caseDoc.caseNumber || 'N/A' },
              { label: 'Supporter', value: `${proName} (${proRole})` },
              { label: 'Supporter email', value: userRecord.email },
              { label: 'Court', value: caseDoc.court || 'Family Court' },
            ]),
            button(`${frontendUrl}/cases/${caseDoc.documentId}`, 'View my case', 'success'),
          ].join('\n'),
          smallPrint:
            '<strong>FPR Part 12 &amp; PD 27A:</strong> family proceedings are confidential. Your supporter has accepted the confidentiality terms of the Family Procedure Rules.',
          supportEmail: 'support@mycasebuddy.justice.gov.uk',
        });

          await emailService.send({
            from: sender,
            to: ownerEmail,
            replyTo: userRecord.email,
            subject: `[My Case Buddy] Peer Support Request Accepted: ${caseDoc.caseNumber || caseDoc.title} (${proName})`,
            html: acceptHtml,
          });
          strapi.log.info(`[AcceptInvite] Dispatched acceptance notification email to LIP ${ownerEmail}`);
        }
      } catch (emailErr) {
        strapi.log.error(`[AcceptInvite] Failed to dispatch acceptance email: ${emailErr}`);
      }
    }

    return {
      success: true,
      case: caseDoc,
      role: invite.role,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name || userRecord.username,
        role: userRecord.userRole,
      },
    };
  },
}));
