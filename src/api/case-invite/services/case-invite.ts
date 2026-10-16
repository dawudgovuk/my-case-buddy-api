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

          const acceptHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Peer Support Request Accepted</title></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%); padding: 36px 30px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; font-size: 26px; margin-bottom: 12px;">🤝</div>
              <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Peer Support Request Accepted!</h1>
              <div style="color: #a7f3d0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">UK Family Court &bull; Practice Direction 27A</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 16px; margin: 0 0 16px 0;">Dear <strong>${ownerName}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
                Great news! <strong>${proName}</strong> (<a href="mailto:${userRecord.email}" style="color: #059669;">${userRecord.email}</a>) has accepted your peer support request for your case.
              </p>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 24px; padding: 18px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px;">Case & Peer Supporter Summary</div>
                    <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${caseDoc.title || 'Family Court Matter'}</div>
                    <div style="font-size: 13px; color: #059669; font-weight: 600; margin-bottom: 12px;">Ref: ${caseDoc.caseNumber || 'N/A'}</div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.6;">
                      <strong>Assigned Supporter:</strong> ${proName} (${proRole})<br/>
                      <strong>Supporter Email:</strong> ${userRecord.email}<br/>
                      <strong>Court:</strong> ${caseDoc.court || 'Family Court'}
                    </div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/cases/${caseDoc.documentId}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 50px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35);">
                      View Case & Supporter &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                <strong>FPR Part 12 & PD 27A Notice:</strong> Family proceedings are confidential. Your peer supporter has accepted terms of confidentiality under the Family Procedure Rules.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
              &copy; ${new Date().getFullYear()} My Case Buddy &bull; Support: support@mycasebuddy.justice.gov.uk
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
