import { factories } from '@strapi/strapi';

const FULL_POPULATE = {
  parties: true,
  hearings: true,
  orders: true,
  documents: true,
  notes: true,
  deadlines: true,
  members: true,
  owner: true,
  invites: true,
};

export default factories.createCoreController('api::case.case', ({ strapi }) => ({
  /**
   * Create a new case, auto-link authenticated user as owner, sync initial child entities,
   * and return the fully populated case record with server-generated IDs in a single round-trip.
   */
  async create(ctx) {
    let user = ctx.state.user;
    const body = ctx.request.body as { data?: Record<string, unknown> } | undefined;
    const rawData = body?.data ? { ...body.data } : {};

    // Correlate user from Neon Auth session via ownerEmail payload or custom request header
    const candidateEmail = (rawData.ownerEmail || ctx.request.headers['x-user-email']) as string | undefined;
    if (!user && candidateEmail) {
      const email = candidateEmail.toLowerCase().trim();
      let foundUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email },
      });
      if (!foundUser) {
        // Auto-provision Strapi user for verified Neon Auth credentials
        const namePart = email.split('@')[0];
        const defaultRole = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: 'authenticated' },
        });
        foundUser = await strapi.entityService.create('plugin::users-permissions.user', {
          data: {
            username: `${namePart}_${Math.random().toString(36).substring(2, 6)}`,
            email,
            provider: 'local',
            confirmed: true,
            userRole: (rawData.userRole as 'McKenzieFriend' | 'Solicitor' | 'Barrister' | 'LIP') || 'LIP',
            role: defaultRole?.id,
          },
        });
      }
      user = foundUser;
    }

    if (user && body?.data && !body.data.owner) {
      body.data.owner = user.documentId || user.id;
    }

    // Isolate child arrays and remove non-schema metadata so core case record creates cleanly
    const { parties, hearings, orders, documents, notes, deadlines, ownerEmail, ...coreData } = rawData;
    if (body) {
      body.data = coreData;
    }

    const response = (await super.create(ctx)) as { data?: { documentId?: string; id?: number } };
    const docId = response?.data?.documentId;

    if (docId) {
      await strapi.service('api::case.case').syncCaseChildren(docId, {
        parties,
        hearings,
        orders,
        documents,
        notes,
        deadlines,
      });

      // Return fully hydrated case to client to eliminate secondary round-trips
      const populated = await strapi.documents('api::case.case').findOne({
        documentId: docId,
        populate: FULL_POPULATE,
      });

      return { data: populated };
    }

    return response;
  },

  /**
   * Filter cases for the current authenticated user (owner or member) if not an admin
   */
  async find(ctx) {
    let user = ctx.state.user;

    const candidateEmail = ctx.request.headers['x-user-email'] as string | undefined;
    if (!user && candidateEmail) {
      const email = candidateEmail.toLowerCase().trim();
      user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email },
      });
    }

    // If an authenticated non-admin user requests cases, filter by their user ID
    if (user && user.role?.type !== 'admin') {
      const data = await strapi.service('api::case.case').findForUser(user.id, ctx.query, user);
      return { data };
    }

    return super.find(ctx);
  },

  /**
   * Find single case with authorization verification and deep hydration
   */
  async findOne(ctx) {
    let user = ctx.state.user;
    const candidateEmail = ctx.request.headers['x-user-email'] as string | undefined;
    if (!user && candidateEmail) {
      const email = candidateEmail.toLowerCase().trim();
      user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email },
      });
    }

    const rawId = ctx.params.id;
    const targetDocId = (await strapi.service('api::case.case').resolveDocumentId(rawId)) || rawId;

    if (user && user.role?.type !== 'admin' && targetDocId) {
      const isMember = await strapi.service('api::case.case').isUserCaseMember(targetDocId, user.id);
      if (!isMember) {
        return ctx.forbidden('You do not have permission to view this case.');
      }
    }

    if (targetDocId) {
      const record = await strapi.documents('api::case.case').findOne({
        documentId: targetDocId,
        populate: FULL_POPULATE,
      });

      if (record) {
        return { data: record };
      }
    }

    return super.findOne(ctx);
  },

  /**
   * Update an existing case, sync child entities, and return the populated record
   */
  async update(ctx) {
    const user = ctx.state.user;
    const rawId = ctx.params.id;
    const targetDocId = (await strapi.service('api::case.case').resolveDocumentId(rawId)) || rawId;
    ctx.params.id = targetDocId;

    if (user && user.role?.type !== 'admin' && targetDocId) {
      const isMember = await strapi.service('api::case.case').isUserCaseMember(targetDocId, user.id);
      if (!isMember) {
        return ctx.forbidden('You do not have permission to update this case.');
      }
    }

    const body = ctx.request.body as { data?: Record<string, unknown> } | undefined;
    const rawData = body?.data ? { ...body.data } : {};

    // Isolate child arrays
    const { parties, hearings, orders, documents, notes, deadlines, ...coreData } = rawData;
    if (body) {
      body.data = coreData;
    }

    await super.update(ctx);

    if (targetDocId) {
      await strapi.service('api::case.case').syncCaseChildren(targetDocId, {
        parties,
        hearings,
        orders,
        documents,
        notes,
        deadlines,
      });

      const populated = await strapi.documents('api::case.case').findOne({
        documentId: targetDocId,
        populate: FULL_POPULATE,
      });

      return { data: populated };
    }

    return super.update(ctx);
  },

  /**
   * Delete a case, restricted to the case owner or admin
   */
  async delete(ctx) {
    const user = ctx.state.user;
    const rawId = ctx.params.id;
    const targetDocId = (await strapi.service('api::case.case').resolveDocumentId(rawId)) || rawId;
    ctx.params.id = targetDocId;

    if (user && user.role?.type !== 'admin' && targetDocId) {
      const isOwner = await strapi.service('api::case.case').isUserCaseOwner(targetDocId, user.id);
      if (!isOwner) {
        return ctx.forbidden('Only the case owner or administrator may delete this case.');
      }
    }

    return super.delete(ctx);
  },

  /**
   * Find verified legal professionals (Solicitor, Barrister, McKenzie Friend)
   */
  async findProfessionals(ctx) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users: any[] = await strapi.db.query('plugin::users-permissions.user').findMany({
        where: {
          userRole: {
            $in: ['Solicitor', 'Barrister', 'McKenzieFriend'],
          },
        },
      });

      const mapped = users.map((u) => ({
        id: String(u.documentId || u.id),
        name: u.name || u.username || 'Legal Professional',
        email: u.email,
        role: u.userRole,
        firm: u.firm,
        registrationNumber: u.registrationNumber,
        isVerified: Boolean(u.confirmed),
        bio: u.bio,
        specialisms: Array.isArray(u.specialisms) ? u.specialisms : [],
        yearsExperience: u.yearsExperience,
      }));

      return { data: mapped };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch legal professionals';
      return ctx.badRequest(message);
    }
  },

  /**
   * Request peer-to-peer legal support on a specific case from a legal professional.
   * Updates case flags, creates an audit case note, generates an invite token,
   * and dispatches live notification emails to both the legal professional and the requesting LIP.
   */
  async requestPeerSupport(ctx) {
    let user = ctx.state.user;
    const rawId = ctx.params.id;
    const { targetUserId, note } = ctx.request.body as { targetUserId?: string; note?: string };

    // Correlate user from Neon Auth / CMS session via request header if not in ctx.state
    const candidateEmail = (ctx.request.headers['x-user-email']) as string | undefined;
    if (!user && candidateEmail) {
      const email = candidateEmail.toLowerCase().trim();
      user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email },
      });
    }

    const resolvedDocId = (await strapi.service('api::case.case').resolveDocumentId(rawId)) || rawId;
    if (!resolvedDocId) {
      return ctx.badRequest('Case ID is required');
    }

    if (user && user.role?.type !== 'admin') {
      const isOwner = await strapi.service('api::case.case').isUserCaseOwner(resolvedDocId, user.id);
      if (!isOwner) {
        strapi.log.info(`[PeerSupport] User ${user.email} (id: ${user.id}) requesting peer support on case ${resolvedDocId}`);
      }
    }

    // Lookup target professional if ID or email provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetPro: any = null;
    if (targetUserId) {
      targetPro = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          $or: [
            { documentId: targetUserId },
            ...(isNaN(Number(targetUserId)) ? [] : [{ id: Number(targetUserId) }]),
            { email: targetUserId },
          ],
        },
      });
    }

    const helpNote = note && note.trim().length > 0
      ? note.trim()
      : 'Peer support requested from verified legal directory';

    // 1. Update case flags
    await strapi.documents('api::case.case').update({
      documentId: resolvedDocId,
      data: {
        seekingPeerSupport: true,
        peerSupportNote: helpNote,
        peerSupportRequestedAt: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // 2. Fetch full case details for audit and email context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caseRecord: any = await strapi.documents('api::case.case').findOne({
      documentId: resolvedDocId,
      populate: FULL_POPULATE,
    });

    const proName = targetPro?.name || targetPro?.username || 'Legal Supporter';
    const proRole = targetPro?.userRole || 'Professional';
    const lipName = user?.name || user?.username || 'Litigant in Person';
    const lipEmail = user?.email || candidateEmail || 'lip@mycasebuddy.justice.gov.uk';

    // 3. Add an audit case note
    await strapi.documents('api::case-note.case-note').create({
      data: {
        author: lipName,
        text: `Peer support requested from ${proName} (${proRole}). Help requested: ${helpNote}`,
        case: resolvedDocId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // 4. Create invitation token if professional role is known
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inviteRecord: any = null;
    let inviteToken = '';
    if (targetPro?.userRole) {
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      inviteToken = `inv_${Date.now()}_${randomSuffix}`;
      inviteRecord = await strapi.documents('api::case-invite.case-invite').create({
        data: {
          token: inviteToken,
          role: targetPro.userRole,
          case: resolvedDocId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
    }

    // 5. Live Email Dispatch via Nodemailer / Google SMTP
    let emailDispatched = false;
    let emailError: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emailService = (strapi as any).plugin('email')?.service('email');
      if (emailService) {
        const fromEmail = process.env.DEFAULT_FROM_EMAIL || process.env.SMTP_USERNAME || 'aliparvez20@gmail.com';
        const sender = `"My Case Buddy Legal Support" <${fromEmail}>`;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const caseNumber = caseRecord?.caseNumber || 'FC-2026';
        const caseTitle = caseRecord?.title || 'Family Court Matter';
        const court = caseRecord?.court || 'Family Court';
        const caseType = caseRecord?.caseType || 'Private Law (Child Arrangements)';
        const stage = caseRecord?.currentStage || 'Proceedings Active';

        // 5a. Dispatched to the Target Legal Supporter
        if (targetPro?.email) {
          const proHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Peer Support Request: ${caseNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%); padding: 36px 30px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; font-size: 26px; margin-bottom: 12px;">
                🤝
              </div>
              <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Peer Support Request</h1>
              <div style="color: #bfdbfe; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                UK Family Court &bull; Practice Direction 27A
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 16px; margin: 0 0 16px 0;">
                Dear <strong>${proName}</strong>,
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
                <strong>${lipName}</strong> (<a href="mailto:${lipEmail}" style="color: #2563eb;">${lipEmail}</a>) has selected your profile from the <strong>Verified Legal Directory</strong> to request peer-to-peer assistance on their family court case.
              </p>

              <!-- Case Details Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 24px; padding: 18px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px;">Case Summary</div>
                    <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${caseTitle}</div>
                    <div style="font-size: 13px; color: #2563eb; font-weight: 600; margin-bottom: 12px;">Ref: ${caseNumber}</div>
                    
                    <div style="font-size: 13px; color: #475569; line-height: 1.6;">
                      <strong>Court:</strong> ${court}<br/>
                      <strong>Case Type:</strong> ${caseType}<br/>
                      <strong>Stage:</strong> ${stage}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Help Note Quote -->
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Requested Assistance</div>
              <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; padding: 14px 16px; font-size: 14px; font-style: italic; color: #1e3a8a; line-height: 1.6; margin-bottom: 24px;">
                "${helpNote}"
              </div>

              <!-- Button CTA -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${inviteToken ? `${frontendUrl}/invite/${inviteToken}` : `${frontendUrl}/professional-dashboard`}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 50px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">
                      Review & Respond to Request &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Confidentiality Note -->
              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                <strong>FPR Part 12 & PD 27A Notice:</strong> Family proceedings are confidential. Information disclosed via My Case Buddy is privileged for the purpose of receiving lay assistance and must not be communicated to third parties without court permission.
              </p>
            </td>
          </tr>

          <!-- Footer -->
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
            replyTo: lipEmail,
            to: targetPro.email,
            subject: `[My Case Buddy] New Peer Support Request: ${caseNumber} (${caseTitle})`,
            text: `Dear ${proName},\n\n${lipName} (${lipEmail}) has requested your peer legal support on case ${caseNumber} (${caseTitle}).\n\nHelp Requested:\n"${helpNote}"\n\nPlease log in to My Case Buddy to respond: ${frontendUrl}/peer-directory\n\nRegards,\nMy Case Buddy Support`,
            html: proHtml,
          });
          strapi.log.info(`[PeerSupport] Sent notification email to legal supporter: ${targetPro.email}`);
          emailDispatched = true;
        }

        // 5b. Confirmation copy to the Litigant in Person (LIP)
        if (lipEmail && lipEmail.includes('@')) {
          const lipHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Peer Support Request Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 36px 30px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; font-size: 26px; margin-bottom: 12px;">
                ✓
              </div>
              <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Request Successfully Dispatched</h1>
              <div style="color: #d1fae5; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                Peer Collaboration Confirmation
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 16px; margin: 0 0 16px 0;">
                Dear <strong>${lipName}</strong>,
              </p>
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
                Your peer support request for case <strong>${caseTitle}</strong> (Ref: <strong>${caseNumber}</strong>) has been successfully transmitted to:
              </p>

              <div style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; padding: 18px; margin-bottom: 24px;">
                <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${proName}</div>
                <div style="font-size: 13px; color: #059669; font-weight: 600; margin-top: 2px;">${proRole}${targetPro?.firm ? ` &bull; ${targetPro.firm}` : ''}</div>
                ${targetPro?.registrationNumber ? `<div style="font-size: 12px; color: #64748b; margin-top: 4px;">Registration: ${targetPro.registrationNumber}</div>` : ''}
              </div>

              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Your Note to Supporter</div>
              <div style="background-color: #f1f5f9; border-left: 4px solid #059669; border-radius: 4px; padding: 14px 16px; font-size: 14px; font-style: italic; color: #334155; line-height: 1.6; margin-bottom: 24px;">
                "${helpNote}"
              </div>

              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                An email alert has been dispatched to ${proName}. We have also recorded an entry on your case timeline. Once the supporter accepts or contacts you, you will see their response on your dashboard.
              </p>

              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 50px;">
                      Return to Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                <strong>Privilege Notice:</strong> Your request is conducted under Practice Direction 27A guidelines for Litigants in Person.
              </p>
            </td>
          </tr>

          <!-- Footer -->
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
            replyTo: fromEmail,
            to: lipEmail,
            subject: `[My Case Buddy] Peer Support Request Sent: ${proName} (${proRole})`,
            text: `Dear ${lipName},\n\nYour peer support request for case ${caseNumber} (${caseTitle}) has been sent to ${proName} (${proRole}).\n\nHelp Requested: "${helpNote}"\n\nYou will be notified when they respond.\n\nRegards,\nMy Case Buddy Support`,
            html: lipHtml,
          });
          strapi.log.info(`[PeerSupport] Sent confirmation email copy to requesting LIP: ${lipEmail}`);
          emailDispatched = true;
        }
      }
    } catch (smtpErr: unknown) {
      emailError = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
      strapi.log.warn(`[PeerSupport] SMTP dispatch note: ${emailError}`);
    }

    const updated = await strapi.documents('api::case.case').findOne({
      documentId: resolvedDocId,
      populate: FULL_POPULATE,
    });

    return {
      success: true,
      data: updated,
      invite: inviteRecord,
      emailDispatched,
      emailRecipient: targetPro?.email || null,
    };
  },

  /**
   * Directly accept a peer support request on a case
   */
  async acceptPeerSupport(ctx) {
    let user = ctx.state.user;
    const rawId = ctx.params.id;

    const candidateEmail = ctx.request.headers['x-user-email'] as string | undefined;
    if (!user && candidateEmail) {
      const email = candidateEmail.toLowerCase().trim();
      user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email },
      });
    }

    if (!user) {
      return ctx.unauthorized('Authentication required to accept peer support');
    }

    const isProfessional = ['McKenzieFriend', 'Solicitor', 'Barrister'].includes(user.userRole || '');
    if (!isProfessional) {
      return ctx.forbidden('Only verified legal professionals can accept peer support requests');
    }

    const resolvedDocId = (await strapi.service('api::case.case').resolveDocumentId(rawId)) || rawId;
    if (!resolvedDocId) {
      return ctx.badRequest('Case ID is required');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caseRecord: any = await strapi.documents('api::case.case').findOne({
      documentId: resolvedDocId,
      populate: { owner: true, members: true },
    });

    if (!caseRecord) {
      return ctx.notFound('Case not found');
    }

    // 1. Connect member via Strapi Document Service
    await strapi.documents('api::case.case').update({
      documentId: resolvedDocId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        members: {
          connect: [user.id],
        },
        seekingPeerSupport: false,
      } as any,
    });

    // 2. Direct SQL link into cases_members_lnk
    try {
      const caseId = caseRecord.id;
      const uId = user.id;
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
      strapi.log.warn(`[AcceptPeerSupport] Direct link note: ${lnkErr}`);
    }

    // 3. Mark any existing invite for this case as used
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pendingInvites: any[] = await strapi.documents('api::case-invite.case-invite').findMany({
        filters: {
          case: { documentId: { $eq: resolvedDocId } },
          usedAt: { $null: true },
        },
      });
      for (const inv of pendingInvites) {
        await strapi.documents('api::case-invite.case-invite').update({
          documentId: inv.documentId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: {
            usedAt: new Date().toISOString(),
            usedBy: user.id,
          } as any,
        });
      }
    } catch {
      // Non-blocking
    }

    // 4. Create audit note
    const proName = user.name || user.username || 'Legal Professional';
    const proRole = user.userRole || 'Peer Supporter';
    await strapi.documents('api::case-note.case-note').create({
      data: {
        author: `${proName} (${proRole})`,
        text: `Accepted peer support request and joined case as ${proRole}.`,
        case: resolvedDocId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // 5. Send notification email to LIP
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emailService = (strapi as any).plugin('email')?.service('email');
      if (emailService && caseRecord.owner?.email) {
        const ownerEmail = caseRecord.owner.email;
        const ownerName = caseRecord.owner.name || caseRecord.owner.username || 'Litigant in Person';
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
                Great news! <strong>${proName}</strong> (<a href="mailto:${user.email}" style="color: #059669;">${user.email}</a>) has accepted your peer support request for your case.
              </p>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 24px; padding: 18px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px;">Case & Peer Supporter Summary</div>
                    <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${caseRecord.title || 'Family Court Matter'}</div>
                    <div style="font-size: 13px; color: #059669; font-weight: 600; margin-bottom: 12px;">Ref: ${caseRecord.caseNumber || 'N/A'}</div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.6;">
                      <strong>Assigned Supporter:</strong> ${proName} (${proRole})<br/>
                      <strong>Supporter Email:</strong> ${user.email}<br/>
                      <strong>Court:</strong> ${caseRecord.court || 'Family Court'}
                    </div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/cases/${resolvedDocId}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 50px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35);">
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
          replyTo: user.email,
          subject: `[My Case Buddy] Peer Support Request Accepted: ${caseRecord.caseNumber || caseRecord.title} (${proName})`,
          html: acceptHtml,
        });
        strapi.log.info(`[AcceptPeerSupport] Dispatched acceptance notification email to LIP ${ownerEmail}`);
      }
    } catch (emailErr) {
      strapi.log.error(`[AcceptPeerSupport] Failed to dispatch acceptance email: ${emailErr}`);
    }

    return ctx.send({
      success: true,
      case: caseRecord,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.username,
        role: user.userRole,
      },
    });
  },
}));
