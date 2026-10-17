import { factories } from '@strapi/strapi';
import { renderEmail, esc, paragraph, detailsCard, quote, button } from '../../../utils/email-layout';

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

    // Isolate child arrays and remove non-schema metadata so core case record creates cleanly
    const { parties, hearings, orders, documents, notes, deadlines, ownerEmail, ...coreData } = rawData;

    // Preserve owner relation on coreData
    if (user && !coreData.owner) {
      coreData.owner = user.documentId || user.id;
    }

    if (body) {
      body.data = coreData;
    }

    const response = (await super.create(ctx)) as { data?: { documentId?: string; id?: number } };
    const docId = response?.data?.documentId;

    if (docId) {
      // Ensure owner relation is securely recorded in cases_owner_lnk
      if (user) {
        try {
          const caseRecord = await strapi.db.query('api::case.case').findOne({
            where: { documentId: docId },
          });
          if (caseRecord?.id && user?.id) {
            const existingLnk = await strapi.db
              .connection('cases_owner_lnk')
              .where({ case_id: caseRecord.id, user_id: user.id })
              .first();

            if (!existingLnk) {
              await strapi.db.connection('cases_owner_lnk').insert({
                case_id: caseRecord.id,
                user_id: user.id,
              });
            }
          }
        } catch (linkErr) {
          strapi.log.warn('Could not auto-link case owner in cases_owner_lnk:', linkErr);
        }
      }

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
          const proHtml = renderEmail({
            title: `New peer support request: ${caseNumber}`,
            preheader: `${lipName} has asked for your help with a family court case.`,
            tone: 'brand',
            eyebrow: 'Peer support request',
            icon: '&#129309;',
            heroTitle: 'Someone has asked for your help',
            heroSubtitle: 'UK Family Court &bull; Practice Direction 27A',
            bodyHtml: [
              paragraph(`Dear <strong style="color:#0f172a;">${esc(proName)}</strong>,`),
              paragraph(
                `<strong style="color:#0f172a;">${esc(lipName)}</strong> (<a href="mailto:${esc(lipEmail)}" style="color:#2b4acb;">${esc(lipEmail)}</a>) chose your profile in the verified legal directory and would like your help with their family court case.`
              ),
              detailsCard('Case summary', [
                { label: 'Case', value: caseTitle },
                { label: 'Reference', value: caseNumber },
                { label: 'Court', value: court },
                { label: 'Case type', value: caseType },
                { label: 'Stage', value: stage },
              ]),
              quote(helpNote, 'brand', 'What they need help with'),
              button(inviteToken ? `${frontendUrl}/invite/${inviteToken}` : `${frontendUrl}/professional-dashboard`, 'Review and respond'),
            ].join('\n'),
            smallPrint:
              '<strong>FPR Part 12 &amp; PD 27A:</strong> family proceedings are confidential. Information shared through My Case Buddy is for giving lay assistance only and must not be passed on without the court&rsquo;s permission.',
            supportEmail: 'support@mycasebuddy.justice.gov.uk',
          });

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
          const lipHtml = renderEmail({
            title: 'Your peer support request was sent',
            preheader: `Your request has been sent to ${proName}.`,
            tone: 'success',
            eyebrow: 'Request sent',
            icon: '&#10003;',
            heroTitle: 'Your request is on its way',
            heroSubtitle: `We have sent it to ${esc(proName)}.`,
            bodyHtml: [
              paragraph(`Dear <strong style="color:#0f172a;">${esc(lipName)}</strong>,`),
              paragraph(
                `Your request for help with <strong style="color:#0f172a;">${esc(caseTitle)}</strong> (reference <strong style="color:#0f172a;">${esc(caseNumber)}</strong>) has been sent to:`
              ),
              detailsCard('Legal supporter', [
                { label: 'Name', value: proName },
                { label: 'Role', value: proRole },
                { label: 'Firm', value: targetPro?.firm || '' },
                { label: 'Registration', value: targetPro?.registrationNumber || '' },
              ]),
              quote(helpNote, 'success', 'Your message'),
              paragraph(
                `We have emailed ${esc(proName)} and added a note to your case timeline. When they accept or get in touch, you will see it on your dashboard.`
              ),
              button(`${frontendUrl}/`, 'Go to my dashboard', 'success'),
            ].join('\n'),
            smallPrint: '<strong>Privilege notice:</strong> your request is made under Practice Direction 27A guidance for litigants in person.',
            supportEmail: 'support@mycasebuddy.justice.gov.uk',
          });

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
              `<strong style="color:#0f172a;">${esc(proName)}</strong> (<a href="mailto:${esc(user.email)}" style="color:#0e7a55;">${esc(user.email)}</a>) has accepted your peer support request and can now help with your case.`
            ),
            detailsCard('Case and supporter', [
              { label: 'Case', value: caseRecord.title || 'Family Court Matter' },
              { label: 'Reference', value: caseRecord.caseNumber || 'N/A' },
              { label: 'Supporter', value: `${proName} (${proRole})` },
              { label: 'Supporter email', value: user.email },
              { label: 'Court', value: caseRecord.court || 'Family Court' },
            ]),
            button(`${frontendUrl}/cases/${resolvedDocId}`, 'View my case', 'success'),
          ].join('\n'),
          smallPrint:
            '<strong>FPR Part 12 &amp; PD 27A:</strong> family proceedings are confidential. Your supporter has accepted the confidentiality terms of the Family Procedure Rules.',
          supportEmail: 'support@mycasebuddy.justice.gov.uk',
        });

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
