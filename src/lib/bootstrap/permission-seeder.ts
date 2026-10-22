import type { Core } from '@strapi/strapi';
import { StrapiService } from '../core/strapi-service';
import { DEFAULT_ROLE_PERMISSIONS } from './default-permissions';

const ROLE_UID = 'plugin::users-permissions.role';
const PERMISSION_UID = 'plugin::users-permissions.permission';
const ROLE_PERMISSION_LINK_TABLE = 'up_permissions_role_lnk';

/** Below this many role/permission links the defaults are (re)applied. */
const SEEDED_LINK_THRESHOLD = 30;

interface RoleRow {
  id: number;
  type: string;
}

/** Grants the default content-API permissions to the public and authenticated roles. */
export class PermissionSeeder extends StrapiService {
  constructor(strapi: Core.Strapi) {
    super(strapi);
  }

  async seed(): Promise<void> {
    try {
      if (await this.alreadySeeded()) {
        this.log.info('✅ Permissions already seeded across Strapi domain roles (skipping)');
        return;
      }

      const roles = (await this.strapi.db.query(ROLE_UID).findMany()) as RoleRow[];
      
      // Fetch all existing permissions in one query
      const existingPermissions = (await this.strapi.db.query(PERMISSION_UID).findMany()) as Array<{ id: number; action: string }>;
      const permissionMap = new Map<string, number>(existingPermissions.map((p) => [p.action, p.id]));

      // Fetch all existing links in one query
      const existingLinks = (await this.strapi.db.connection(ROLE_PERMISSION_LINK_TABLE).select('permission_id', 'role_id')) as Array<{
        permission_id: number;
        role_id: number;
      }>;
      const linkSet = new Set(existingLinks.map((l) => `${l.permission_id}:${l.role_id}`));

      // Grant authenticated permissions to Authenticated and all domain-specific roles
      const authenticatedRoles = ['authenticated', 'lip', 'mckenzie_friend', 'solicitor', 'barrister'] as const;
      for (const roleType of authenticatedRoles) {
        const role = roles?.find((r) => r.type === roleType);
        if (role) {
          await this.grantOptimized(role, roleType, DEFAULT_ROLE_PERMISSIONS.authenticated, permissionMap, linkSet);
        }
      }

      // Grant public permissions
      const publicRole = roles?.find((r) => r.type === 'public');
      if (publicRole) {
        await this.grantOptimized(publicRole, 'public', DEFAULT_ROLE_PERMISSIONS.public, permissionMap, linkSet);
      }
      this.log.info('✅ Permissions synced across all Strapi domain roles');
    } catch (err: unknown) {
      this.log.warn('Could not auto-seed default permissions:', err);
    }
  }

  private async alreadySeeded(): Promise<boolean> {
    const row = (await this.strapi.db.connection(ROLE_PERMISSION_LINK_TABLE).count('* as count').first()) as
      | { count?: number | string }
      | undefined;
    return Number(row?.count || 0) >= SEEDED_LINK_THRESHOLD;
  }

  private async grantOptimized(
    role: RoleRow,
    roleType: string,
    actions: readonly string[],
    permissionMap: Map<string, number>,
    linkSet: Set<string>
  ): Promise<void> {
    const linksToInsert: Array<{ permission_id: number; role_id: number; permission_ord: number }> = [];

    for (const action of actions) {
      try {
        let permissionId = permissionMap.get(action);
        if (!permissionId) {
          const created = (await this.strapi.db.query(PERMISSION_UID).create({ data: { action } })) as { id: number };
          permissionId = created.id;
          permissionMap.set(action, permissionId);
        }

        const linkKey = `${permissionId}:${role.id}`;
        if (!linkSet.has(linkKey)) {
          linksToInsert.push({ permission_id: permissionId, role_id: role.id, permission_ord: 1 });
          linkSet.add(linkKey);
        }
      } catch (actionErr) {
        this.log.debug(`Could not sync action ${action} for ${roleType}:`, actionErr);
      }
    }

    if (linksToInsert.length > 0) {
      await this.strapi.db.connection(ROLE_PERMISSION_LINK_TABLE).insert(linksToInsert);
    }
  }
}
