import type { Core } from '@strapi/strapi';
import { StrapiService } from '../core/strapi-service';
import { isNumericId, type AppUser, type EntityId } from '../domain/models';
import { userRoleToSlug, roleDisplayName, type UserRole } from '../domain/roles';

const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';

/** Reads and creates users-permissions users. All user queries go through here. */
export class UserRepository extends StrapiService {
  constructor(strapi: Core.Strapi) {
    super(strapi);
  }

  async findByEmail(email: string): Promise<AppUser | null> {
    return (await this.strapi.db.query(USER_UID).findOne({
      where: { email },
      populate: ['role'],
    })) as AppUser | null;
  }

  /** Looks a user up by numeric id or documentId. */
  async findById(userId: EntityId): Promise<AppUser | null> {
    return (await this.strapi.db.query(USER_UID).findOne({
      where: isNumericId(userId) ? { id: Number(userId) } : { documentId: String(userId) },
      populate: ['role'],
    })) as AppUser | null;
  }

  /** Looks a user up by documentId, numeric id or email (used for directory selections). */
  async findByAnyIdentifier(identifier: string): Promise<AppUser | null> {
    return (await this.strapi.db.query(USER_UID).findOne({
      where: {
        $or: [
          { documentId: identifier },
          ...(isNaN(Number(identifier)) ? [] : [{ id: Number(identifier) }]),
          { email: identifier },
        ],
      },
      populate: ['role'],
    })) as AppUser | null;
  }

  async findByRoles(roles: readonly string[]): Promise<AppUser[]> {
    const slugs = roles.map((r) => userRoleToSlug(r));
    return (await this.strapi.db.query(USER_UID).findMany({
      where: {
        $or: [
          { userRole: { $in: [...roles] } },
          { role: { type: { $in: slugs } } },
        ],
      },
      populate: ['role'],
    })) as AppUser[];
  }

  async findAuthenticatedRoleId(): Promise<number | undefined> {
    const role = (await this.strapi.db.query(ROLE_UID).findOne({ where: { type: 'authenticated' } })) as { id?: number } | null;
    return role?.id;
  }

  /** Finds the role ID corresponding to a domain UserRole. */
  async findRoleIdForUserRole(userRole: UserRole | string): Promise<number | undefined> {
    const slug = userRoleToSlug(userRole);
    const role = (await this.strapi.db.query(ROLE_UID).findOne({
      where: {
        $or: [
          { type: slug },
          { name: roleDisplayName(userRole) },
          { name: userRole },
        ],
      },
    })) as { id?: number } | null;
    return role?.id;
  }

  /** Creates a confirmed local user with a random username suffix and binds to their Strapi role. */
  async createLocalUser(data: {
    usernameBase: string;
    email: string;
    userRole: UserRole;
    roleId?: number;
    extra?: Record<string, unknown>;
  }): Promise<AppUser> {
    const targetRoleId =
      data.roleId || (await this.findRoleIdForUserRole(data.userRole)) || (await this.findAuthenticatedRoleId());

    const user = (await this.strapi.entityService.create(USER_UID, {
      data: {
        username: `${data.usernameBase}_${Math.random().toString(36).substring(2, 6)}`,
        email: data.email,
        provider: 'local',
        confirmed: true,
        userRole: data.userRole,
        role: targetRoleId,
        ...(data.extra || {}),
      },
    })) as unknown as AppUser;

    if (user?.id && targetRoleId) {
      try {
        const linkTable = this.strapi.db.connection('up_users_role_lnk');
        const existing = await linkTable.where({ user_id: user.id }).first();
        if (existing) {
          await linkTable.where({ user_id: user.id }).update({ role_id: targetRoleId });
        } else {
          await linkTable.insert({
            user_id: user.id,
            role_id: targetRoleId,
            user_ord: 1,
          });
        }
      } catch {
        // Non-blocking fallback
      }
    }

    return user;
  }
}
