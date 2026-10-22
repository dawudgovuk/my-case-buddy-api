export const USER_ROLES = ['LIP', 'McKenzieFriend', 'Solicitor', 'Barrister'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROFESSIONAL_ROLES = ['McKenzieFriend', 'Solicitor', 'Barrister'] as const;
export type ProfessionalRole = (typeof PROFESSIONAL_ROLES)[number];

export function isProfessionalRole(role: unknown): role is ProfessionalRole {
  return typeof role === 'string' && (PROFESSIONAL_ROLES as readonly string[]).includes(role);
}

/** Human-readable role name used in emails and Strapi display. */
export function roleDisplayName(role: string): string {
  if (role === 'McKenzieFriend' || role === 'mckenzie_friend') return 'McKenzie Friend';
  if (role === 'LIP' || role === 'lip') return 'Litigant in Person';
  if (role === 'Solicitor' || role === 'solicitor') return 'Solicitor';
  if (role === 'Barrister' || role === 'barrister') return 'Barrister';
  return role;
}

/** Converts a domain UserRole into a Strapi Users & Permissions role slug. */
export function userRoleToSlug(role: string): string {
  const clean = role.toLowerCase().replace(/[-_\s]/g, '');
  if (clean === 'lip' || clean === 'litigantinperson') return 'lip';
  if (clean === 'mckenziefriend' || clean === 'mckenzie') return 'mckenzie_friend';
  if (clean === 'solicitor') return 'solicitor';
  if (clean === 'barrister') return 'barrister';
  return 'lip';
}

/** Converts a Strapi role slug or name back to the canonical domain UserRole. */
export function slugToUserRole(identifier: unknown): UserRole {
  if (!identifier) return 'LIP';
  const clean = String(identifier).toLowerCase().replace(/[-_\s]/g, '');
  if (clean === 'lip' || clean === 'litigantinperson') return 'LIP';
  if (clean === 'mckenziefriend' || clean === 'mckenzie') return 'McKenzieFriend';
  if (clean === 'solicitor') return 'Solicitor';
  if (clean === 'barrister') return 'Barrister';
  return 'LIP';
}

