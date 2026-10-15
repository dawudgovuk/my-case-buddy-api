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
    const user = ctx.state.user;
    const body = ctx.request.body as { data?: Record<string, unknown> } | undefined;
    const rawData = body?.data ? { ...body.data } : {};

    if (user && body?.data && !body.data.owner) {
      body.data.owner = user.documentId || user.id;
    }

    // Isolate child arrays so standard Strapi create creates the core case record cleanly
    const { parties, hearings, orders, documents, notes, deadlines, ...coreData } = rawData;
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
    const user = ctx.state.user;

    // If an authenticated non-admin user requests cases, filter by their user ID
    if (user && user.role?.type !== 'admin') {
      const data = await strapi.service('api::case.case').findForUser(user.id, ctx.query);
      return { data };
    }

    return super.find(ctx);
  },

  /**
   * Find single case with authorization verification and deep hydration
   */
  async findOne(ctx) {
    const user = ctx.state.user;
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
          confirmed: true,
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
   * Request peer-to-peer legal support on a specific case from a legal professional
   */
  async requestPeerSupport(ctx) {
    const user = ctx.state.user;
    const rawId = ctx.params.id;
    const { targetUserId, note } = ctx.request.body as { targetUserId?: string; note?: string };

    const resolvedDocId = (await strapi.service('api::case.case').resolveDocumentId(rawId)) || rawId;
    if (!resolvedDocId) {
      return ctx.badRequest('Case ID is required');
    }

    if (user && user.role?.type !== 'admin') {
      const isOwner = await strapi.service('api::case.case').isUserCaseOwner(resolvedDocId, user.id);
      if (!isOwner) {
        return ctx.forbidden('Only the case owner may request peer support for this case.');
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

    // 2. Add an audit case note
    const proName = targetPro?.name || targetPro?.username || 'Legal Supporter';
    const proRole = targetPro?.userRole || 'Professional';
    await strapi.documents('api::case-note.case-note').create({
      data: {
        author: user?.username || 'Case Litigant',
        text: `Peer support requested from ${proName} (${proRole}). Help requested: ${helpNote}`,
        case: resolvedDocId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // 3. Create invitation token if professional role is known
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inviteRecord: any = null;
    if (targetPro?.userRole) {
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const token = `inv_${Date.now()}_${randomSuffix}`;
      inviteRecord = await strapi.documents('api::case-invite.case-invite').create({
        data: {
          token,
          role: targetPro.userRole,
          case: resolvedDocId,
          createdBy: user?.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
    }

    const updated = await strapi.documents('api::case.case').findOne({
      documentId: resolvedDocId,
      populate: FULL_POPULATE,
    });

    return {
      success: true,
      data: updated,
      invite: inviteRecord,
    };
  },
}));
