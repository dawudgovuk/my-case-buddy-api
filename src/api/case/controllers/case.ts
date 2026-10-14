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
      body.data.owner = user.id;
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
    const targetDocId = ctx.params.id;

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
    const targetDocId = ctx.params.id;

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
    const targetDocId = ctx.params.id;

    if (user && user.role?.type !== 'admin' && targetDocId) {
      const isOwner = await strapi.service('api::case.case').isUserCaseOwner(targetDocId, user.id);
      if (!isOwner) {
        return ctx.forbidden('Only the case owner or administrator may delete this case.');
      }
    }

    return super.delete(ctx);
  },
}));
