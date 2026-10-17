export const USER_ROLES = ['LIP', 'McKenzieFriend', 'Solicitor', 'Barrister'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROFESSIONAL_ROLES = ['McKenzieFriend', 'Solicitor', 'Barrister'] as const;
export type ProfessionalRole = (typeof PROFESSIONAL_ROLES)[number];

export function isProfessionalRole(role: unknown): role is ProfessionalRole {
  return typeof role === 'string' && (PROFESSIONAL_ROLES as readonly string[]).includes(role);
}

/** Human-readable role name used in emails. */
export function roleDisplayName(role: string): string {
  if (role === 'McKenzieFriend') return 'McKenzie Friend';
  if (role === 'LIP') return 'Litigant in Person';
  return role;
}
