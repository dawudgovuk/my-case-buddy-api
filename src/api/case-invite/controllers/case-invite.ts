import { factories } from '@strapi/strapi';
import crypto from 'crypto';
import { RequestUserResolver } from '../../../lib/users/request-user-resolver';
import { UserRepository } from '../../../lib/users/user-repository';
import { inviteExpiry } from '../services/case-invite';

export default factories.createCoreController('api::case-invite.case-invite', ({ strapi }) => {
  const resolver = new RequestUserResolver(new UserRepository(strapi));

  return {
    /** Fills in a random token, a 30-day expiry and the creator when the client omits them. */
    async create(ctx) {
      const body = ctx.request.body as { data?: Record<string, unknown> } | undefined;
      const data = body && typeof body === 'object' ? body.data : undefined;
      if (data) {
        data.token ||= crypto.randomUUID();
        data.expiresAt ||= inviteExpiry();
        if (ctx.state.user && !data.createdBy) data.createdBy = ctx.state.user.id;
      }
      return super.create(ctx);
    },

    /** POST /api/case-invites/accept */
    async accept(ctx) {
      const user = await resolver.resolve(ctx);
      if (!user) return ctx.unauthorized('Authentication required to accept an invite');

      const { token } = (ctx.request.body as { token?: string }) || {};
      if (!token) return ctx.badRequest('Missing invite token in request body');

      return ctx.send(await strapi.service('api::case-invite.case-invite').acceptInvite(token, user.id));
    },
  };
});
