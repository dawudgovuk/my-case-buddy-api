import { factories } from '@strapi/strapi';
import crypto from 'crypto';

export default factories.createCoreController('api::case-invite.case-invite', ({ strapi }) => ({
  /**
   * Automatically generate UUID token and expiration on create if not provided
   */
  async create(ctx) {
    const user = ctx.state.user;

    if (ctx.request.body && typeof ctx.request.body === 'object') {
      const body = ctx.request.body as { data?: Record<string, unknown> };
      if (body.data) {
        if (!body.data.token) {
          body.data.token = crypto.randomUUID();
        }
        if (!body.data.expiresAt) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          body.data.expiresAt = expiresAt.toISOString();
        }
        if (user && !body.data.createdBy) {
          body.data.createdBy = user.id;
        }
      }
    }

    return super.create(ctx);
  },

  /**
   * Custom endpoint: POST /api/case-invites/accept
   */
  async accept(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('Authentication required to accept an invite');
    }

    const { token } = (ctx.request.body as { token?: string }) || {};
    if (!token) {
      return ctx.badRequest('Missing invite token in request body');
    }

    const result = await strapi.service('api::case-invite.case-invite').acceptInvite(token, user.id);
    return ctx.send(result);
  },
}));
