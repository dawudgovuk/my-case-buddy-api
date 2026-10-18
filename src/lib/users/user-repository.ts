import type { Core } from '@strapi/strapi';
import { StrapiService } from '../core/strapi-service';
import { isNumericId, type AppUser, type EntityId } from '../domain/models';
import type { UserRole } from '../domain/roles';

const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';

/** Reads and creates users-permissions users. All user queries go through here. */
export class UserRepository extends StrapiService {
  constructor(strapi: Core.Strapi) {
    super(strapi);
  }

  async findByEmail(email: string): Promise<AppUser | null> {
    return (await this.strapi.db.query(USER_UID).findOne({ where: { email } })) as AppUser | null;
  }

  /** Looks a user up by numeric id or documentId. */
  async findById(userId: EntityId): Promise<AppUser | null> {
    return (await this.strapi.db.query(USER_UID).findOne({
      where: isNumericId(userId) ? { id: Number(userId) } : { documentId: String(userId) },
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
    })) as AppUser | null;
  }

  async findByRoles(roles: readonly string[]): Promise<AppUser[]> {
    return (await this.strapi.db.query(USER_UID).findMany({
      where: { userRole: { $in: [...roles] } },
    })) as AppUser[];
  }

  async findAuthenticatedRoleId(): Promise<number | undefined> {
    const role = (await this.strapi.db.query(ROLE_UID).findOne({ where: { type: 'authenticated' } })) as { id?: number } | null;
    return role?.id;
  }

  /** Creates a confirmed local user with a random username suffix. */
  async createLocalUser(data: {
    usernameBase: string;
    email: string;
    userRole: UserRole;
    roleId?: number;
    extra?: Record<string, unknown>;
  }): Promise<AppUser> {
    const user = (await this.strapi.entityService.create(USER_UID, {
      data: {
        username: `${data.usernameBase}_${Math.random().toString(36).substring(2, 6)}`,
        email: data.email,
        provider: 'local',
        confirmed: true,
        userRole: data.userRole,
        role: data.roleId,
        ...(data.extra || {}),
      },
    })) as unknown as AppUser;

    if (user?.id && data.roleId) {
      try {
        await this.strapi.db.connection.raw(
          'INSERT INTO up_users_role_lnk (user_id, role_id, user_ord) VALUES (?, ?, 1) ON CONFLICT DO NOTHING',
          [user.id, data.roleId]
        );
      } catch {
        // Non-blocking
      }
    }

    return user;
  }
}
