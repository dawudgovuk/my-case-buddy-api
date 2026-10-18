import type { Core } from '@strapi/strapi';
import { RequestUserResolver } from '../../../lib/users/request-user-resolver';
import { UserRepository } from '../../../lib/users/user-repository';
import type { UserRole } from '../../../lib/domain/roles';

interface ProfileContext {
  state: { user?: any };
  request: {
    headers: Record<string, string | string[] | undefined>;
    body?: Record<string, unknown>;
  };
  unauthorized(message: string): unknown;
  send(body: unknown): unknown;
  badRequest(message: string): unknown;
  internalServerError(message: string): unknown;
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const resolver = new RequestUserResolver(new UserRepository(strapi));

  return {
    /**
     * GET /api/user-profile
     * Fetches current authenticated user's profile with extended attributes.
     */
    async getProfile(ctx: ProfileContext) {
      try {
        const email = resolver.headerEmail(ctx);
        const user = await resolver.resolve(ctx, email);
        if (!user) {
          return ctx.unauthorized('Authentication required to view profile');
        }

        const freshUser = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: user.id },
        });

        return ctx.send({
          success: true,
          user: freshUser,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch user profile';
        strapi.log.error(`[UserProfileController] getProfile error: ${message}`);
        return ctx.internalServerError(message);
      }
    },

    /**
     * PUT /api/user-profile
     * Updates profile fields for the authenticated user (via Strapi JWT or Neon Auth session).
     */
    async updateProfile(ctx: ProfileContext) {
      try {
        const email = resolver.headerEmail(ctx);
        const body = ctx.request.body || {};
        const targetRole = ((body.userRole || body.role || 'LIP') as UserRole);

        const user =
          (await resolver.resolve(ctx, email)) ||
          (await resolver.resolveOrProvision(ctx, email, targetRole));

        if (!user) {
          return ctx.unauthorized('Authentication required to update profile');
        }

        const updateData: Record<string, unknown> = {};
        if (typeof body.name === 'string') updateData.name = body.name.trim();
        if (typeof body.bio === 'string') updateData.bio = body.bio.trim();
        if (typeof body.firm === 'string') updateData.firm = body.firm.trim();
        if (typeof body.registrationNumber === 'string') updateData.registrationNumber = body.registrationNumber.trim();
        if (typeof body.phone === 'string') updateData.phone = body.phone.trim();
        if (typeof body.yearsExperience === 'number') updateData.yearsExperience = body.yearsExperience;
        if (typeof body.yearsExperience === 'string' && !isNaN(Number(body.yearsExperience))) {
          updateData.yearsExperience = Number(body.yearsExperience);
        }
        if (Array.isArray(body.specialisms)) updateData.specialisms = body.specialisms;
        if (body.userRole || body.role) {
          const r = String(body.userRole || body.role);
          if (['LIP', 'McKenzieFriend', 'Solicitor', 'Barrister'].includes(r)) {
            updateData.userRole = r;
          }
        }

        const updated = await strapi.db.query('plugin::users-permissions.user').update({
          where: { id: user.id },
          data: updateData,
        });

        // Mirror name to neon_auth.user if table exists and user has Neon auth entry
        if (updateData.name && email) {
          try {
            await strapi.db.connection.raw(
              'UPDATE neon_auth.user SET name = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE email = ?',
              [updateData.name, email.toLowerCase()]
            );
          } catch {
            // Neon auth mirror non-blocking
          }
        }

        return ctx.send({
          success: true,
          user: updated,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update user profile';
        strapi.log.error(`[UserProfileController] updateProfile error: ${message}`);
        return ctx.internalServerError(message);
      }
    },
  };
};
