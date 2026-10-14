import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::case.case', ({ strapi }) => ({
  /**
   * Create a new case and automatically link the authenticated user as owner (SOLID - SRP)
   */
  async create(ctx) {
    const user = ctx.state.user;

    if (user && ctx.request.body && typeof ctx.request.body === 'object') {
      const body = ctx.request.body as { data?: Record<string, unknown> };
      if (body.data && !body.data.owner) {
        body.data.owner = user.id;
      }
    }

    return super.create(ctx);
  },

  /**
   * Filter cases for the current authenticated user if not an admin
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
}));
