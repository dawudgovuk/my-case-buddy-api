/**
 * Typed shapes of the Strapi records this API works with.
 * Only the fields the code reads are declared; records may carry more.
 */
export type EntityId = number | string;

export interface AppUser {
  id: number;
  documentId?: string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  userRole?: string | null;
  firm?: string | null;
  registrationNumber?: string | null;
  confirmed?: boolean | null;
  bio?: string | null;
  specialisms?: unknown;
  yearsExperience?: number | null;
  role?: { type?: string } | null;
}

export interface RelatedRef {
  id?: EntityId;
  documentId?: string;
}

export interface CaseRecord {
  id: number;
  documentId: string;
  caseNumber?: string | null;
  title?: string | null;
  court?: string | null;
  caseType?: string | null;
  currentStage?: string | null;
  seekingPeerSupport?: boolean | null;
  owner?: AppUser | null;
  members?: AppUser[] | null;
  [key: string]: unknown;
}

export interface CaseInviteRecord {
  id: number;
  documentId: string;
  token: string;
  role: string;
  expiresAt?: string | null;
  usedAt?: string | null;
  case?: CaseRecord | null;
}

export type ApiData = Record<string, unknown>;

/** A user is an administrator when their users-permissions role type is "admin". */
export function isAdmin(user: AppUser | null | undefined): boolean {
  return user?.role?.type === 'admin';
}

/** Matches a user against an id that may be the numeric id or the documentId. */
export function sameUser(ref: RelatedRef | null | undefined, userId: EntityId): boolean {
  if (!ref) return false;
  const target = String(userId);
  return String(ref.id) === target || Boolean(ref.documentId && String(ref.documentId) === target);
}

export function isNumericId(value: EntityId): boolean {
  return !isNaN(Number(value));
}
