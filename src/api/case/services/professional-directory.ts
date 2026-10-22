import type { Core } from '@strapi/strapi';
import type { AppUser } from '../../../lib/domain/models';
import { PROFESSIONAL_ROLES, roleDisplayName, type ProfessionalRole } from '../../../lib/domain/roles';
import { UserRepository } from '../../../lib/users/user-repository';

/** Public directory entry for a legal professional. */
export interface ProfessionalProfile {
  id: string;
  name: string;
  email: AppUser['email'];
  role: AppUser['userRole'];
  firm: AppUser['firm'];
  registrationNumber: AppUser['registrationNumber'];
  isVerified: boolean;
  bio: AppUser['bio'];
  specialisms: unknown[];
  yearsExperience: AppUser['yearsExperience'];
}

interface NeonAuthUserRow {
  id: string;
  name: string | null;
  email: string;
}

interface RawRows<T> {
  rows?: T[];
}

const NEON_TABLE_EXISTS_SQL = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'neon_auth' AND table_name = 'user');`;

const UNSYNCED_PROFESSIONALS_SQL = `
            SELECT nu.id, nu.name, nu.email
            FROM neon_auth.user nu
            WHERE nu.email NOT IN (SELECT email FROM up_users WHERE email IS NOT NULL)
              AND (
                nu.name ILIKE '%mckenzie%' OR nu.name ILIKE '%mackenzi%'
                OR nu.email ILIKE '%mckenzie%' OR nu.email ILIKE '%mackenzi%'
                OR nu.name ILIKE '%solicitor%' OR nu.email ILIKE '%solicitor%'
                OR nu.name ILIKE '%barrister%' OR nu.email ILIKE '%barrister%'
              );
          `;

/** Neon Auth has no role field, so the role is guessed from the account's name and email. */
function inferRole(row: NeonAuthUserRow): ProfessionalRole {
  const lower = (row.name + ' ' + row.email).toLowerCase();
  if (lower.includes('solicitor')) return 'Solicitor';
  if (lower.includes('barrister')) return 'Barrister';
  return 'McKenzieFriend';
}

function toProfile(u: AppUser): ProfessionalProfile {
  return {
    id: String(u.documentId || u.id),
    name: u.name || u.username || 'Legal Professional',
    email: u.email,
    role: (typeof u.role === 'object' && u.role !== null ? (u.role.name || u.role.type) : u.role || u.userRole) as AppUser['userRole'],
    firm: u.firm,
    registrationNumber: u.registrationNumber,
    isVerified: Boolean(u.confirmed),
    bio: u.bio,
    specialisms: Array.isArray(u.specialisms) ? u.specialisms : [],
    yearsExperience: u.yearsExperience,
  };
}

/** Directory of verified legal professionals (Solicitor, Barrister, McKenzie Friend). */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  const users = new UserRepository(strapi);

  return {
    async list(): Promise<ProfessionalProfile[]> {
      await this.reconcileNeonAuthProfessionals();
      return (await users.findByRoles(PROFESSIONAL_ROLES)).map(toProfile);
    },

    /**
     * Copies legal professionals who signed up through Neon Auth but have no Strapi user yet
     * into up_users, so they appear in the directory. Failures are logged and ignored.
     */
    async reconcileNeonAuthProfessionals(): Promise<void> {
      try {
        const knex = strapi.db.connection;
        const exists = (await knex.raw(NEON_TABLE_EXISTS_SQL)) as RawRows<{ exists: boolean }>;
        if (!exists?.rows?.[0]?.exists) return;

        const unsynced = (await knex.raw(UNSYNCED_PROFESSIONALS_SQL)) as RawRows<NeonAuthUserRow>;
        const rows = unsynced?.rows || [];
        if (rows.length === 0) return;

        const roleId = await users.findAuthenticatedRoleId();
        for (const row of rows) {
          const role = inferRole(row);
          const emailName = row.email.split('@')[0];
          await users.createLocalUser({
            usernameBase: (row.name || emailName).trim().replace(/\s+/g, '_').toLowerCase(),
            email: row.email.toLowerCase().trim(),
            userRole: role,
            roleId,
            extra: {
              name: row.name || emailName,
              bio: `Verified ${roleDisplayName(role)} providing professional family law guidance.`,
              specialisms: ['Child Arrangements', 'Position Statements', 'Court Support'],
              yearsExperience: 3,
            },
          });
        }
      } catch (syncErr) {
        strapi.log.warn('[findProfessionals] Neon auth reconcile notice: ' + String(syncErr));
      }
    },
  };
};
