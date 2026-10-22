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
      const roles = (await this.strapi.db.query(ROLE_UID).findMany()) as RoleRow[];
      
      // Grant authenticated permissions to Authenticated and all domain-specific roles
      const authenticatedRoles = ['authenticated', 'lip', 'mckenzie_friend', 'solicitor', 'barrister'] as const;
      for (const roleType of authenticatedRoles) {
        const role = roles?.find((r) => r.type === roleType);
        if (role) {
          await this.grant(role, roleType, DEFAULT_ROLE_PERMISSIONS.authenticated);
        }
      }

      // Grant public permissions
      const publicRole = roles?.find((r) => r.type === 'public');
      if (publicRole) {
        await this.grant(publicRole, 'public', DEFAULT_ROLE_PERMISSIONS.public);
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

  private async grant(role: RoleRow, roleType: string, actions: readonly string[]): Promise<void> {
    for (const action of actions) {
      try {
        const permission = await this.findOrCreatePermission(action);
        if (permission?.id) await this.linkPermission(permission.id, role.id);
      } catch (actionErr) {
        this.log.debug(`Could not sync action ${action} for ${roleType}:`, actionErr);
      }
    }
  }

  private async findOrCreatePermission(action: string): Promise<{ id?: number } | null> {
    const existing = (await this.strapi.db.query(PERMISSION_UID).findOne({ where: { action } })) as { id?: number } | null;
    return existing ?? ((await this.strapi.db.query(PERMISSION_UID).create({ data: { action } })) as { id?: number });
  }

  private async linkPermission(permissionId: number, roleId: number): Promise<void> {
    const table = () => this.strapi.db.connection(ROLE_PERMISSION_LINK_TABLE);
    const linked = await table().where({ permission_id: permissionId, role_id: roleId }).first();
    if (!linked) {
      await table().insert({ permission_id: permissionId, role_id: roleId, permission_ord: 1 });
    }
  }
}
