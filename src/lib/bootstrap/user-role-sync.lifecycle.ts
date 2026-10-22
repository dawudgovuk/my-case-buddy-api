import type { Core } from '@strapi/strapi';
import { userRoleToSlug, roleDisplayName, slugToUserRole, type UserRole } from '../domain/roles';

const ROLE_UID = 'plugin::users-permissions.role';

/**
 * Subscribes to Strapi database lifecycles on plugin::users-permissions.user
 * to ensure bidirectional synchronization between the Strapi Role relation
 * (up_users_role_lnk) and the domain userRole field (up_users.user_role).
 */
export function registerUserRoleLifecycle(strapi: Core.Strapi) {
  strapi.db.lifecycles.subscribe({
    models: ['plugin::users-permissions.user'],

    async afterCreate(event: any) {
      const { result, params } = event;
      if (!result?.id) return;

      const rawRole = params?.data?.userRole || params?.data?.role;
      if (!rawRole) return;

      try {
        let roleId: number | undefined;

        if (typeof rawRole === 'number') {
          roleId = rawRole;
        } else if (typeof rawRole === 'object' && rawRole !== null && 'id' in rawRole) {
          roleId = Number(rawRole.id);
        } else if (typeof rawRole === 'string') {
          const slug = userRoleToSlug(rawRole);
          const found = (await strapi.db.query(ROLE_UID).findOne({
            where: {
              $or: [
                { type: slug },
                { name: roleDisplayName(rawRole) },
                { name: rawRole },
              ],
            },
          })) as { id?: number } | null;
          roleId = found?.id;
        }

        if (roleId) {
          const linkTable = strapi.db.connection('up_users_role_lnk');
          const existing = await linkTable.where({ user_id: result.id }).first();
          if (existing) {
            await linkTable.where({ user_id: result.id }).update({ role_id: roleId });
          } else {
            await linkTable.insert({ user_id: result.id, role_id: roleId, user_ord: 1 });
          }
        }
      } catch (err) {
        strapi.log.warn('[userRoleLifecycle] Failed to synchronize role on afterCreate: ' + String(err));
      }
    },

    async afterUpdate(event: any) {
      const { result, params } = event;
      if (!result?.id) return;

      try {
        const linkTable = strapi.db.connection('up_users_role_lnk');

        // Case A: userRole attribute updated -> sync to Strapi role relation
        if (params?.data?.userRole) {
          const roleStr = String(params.data.userRole);
          const slug = userRoleToSlug(roleStr);
          const found = (await strapi.db.query(ROLE_UID).findOne({
            where: {
              $or: [
                { type: slug },
                { name: roleDisplayName(roleStr) },
                { name: roleStr },
              ],
            },
          })) as { id?: number } | null;

          if (found?.id) {
            const existing = await linkTable.where({ user_id: result.id }).first();
            if (existing) {
              await linkTable.where({ user_id: result.id }).update({ role_id: found.id });
            } else {
              await linkTable.insert({ user_id: result.id, role_id: found.id, user_ord: 1 });
            }
          }
        }

        // Case B: Strapi role dropdown changed in Admin Panel -> sync back to user_role column
        else if (params?.data?.role !== undefined) {
          const rawRole = params.data.role;
          const roleId =
            typeof rawRole === 'number'
              ? rawRole
              : typeof rawRole === 'object' && rawRole !== null && 'id' in rawRole
              ? Number(rawRole.id)
              : undefined;

          if (roleId) {
            const role = (await strapi.db.query(ROLE_UID).findOne({ where: { id: roleId } })) as {
              type?: string;
              name?: string;
            } | null;
            if (role) {
              const domainRole: UserRole = slugToUserRole(role.type || role.name);
              await strapi.db.connection('up_users').where({ id: result.id }).update({ user_role: domainRole });
            }
          }
        }
      } catch (err) {
        strapi.log.warn('[userRoleLifecycle] Failed to synchronize role on afterUpdate: ' + String(err));
      }
    },
  });
}
