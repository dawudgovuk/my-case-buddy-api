import type { AppUser } from '../domain/models';
import type { UserRole } from '../domain/roles';
import type { UserRepository } from './user-repository';

/** The parts of a Koa/Strapi request context needed to identify the caller. */
export interface CallerContext {
  state: { user?: AppUser };
  request: { headers: Record<string, string | string[] | undefined> };
}

export const USER_EMAIL_HEADER = 'x-user-email';

/**
 * Works out who is calling: the authenticated Strapi user, or — for clients that only hold a
 * Neon Auth session — the user named in the `X-User-Email` header.
 */
export class RequestUserResolver {
  constructor(private readonly users: UserRepository) {}

  /** The raw `X-User-Email` header value, if any. */
  headerEmail(ctx: CallerContext): string | undefined {
    const value = ctx.request.headers[USER_EMAIL_HEADER];
    return (Array.isArray(value) ? value[0] : value) || undefined;
  }

  /** Authenticated user, otherwise the user matching `candidateEmail` (default: the header). */
  async resolve(ctx: CallerContext, candidateEmail: string | undefined = this.headerEmail(ctx)): Promise<AppUser | null> {
    if (ctx.state.user) return ctx.state.user;
    if (!candidateEmail) return null;
    return this.users.findByEmail(candidateEmail.toLowerCase().trim());
  }

  /**
   * Like `resolve`, but creates a confirmed user when the email is not known yet
   * (accounts that exist only in Neon Auth).
   */
  async resolveOrProvision(ctx: CallerContext, candidateEmail: string | undefined, userRole: UserRole): Promise<AppUser | null> {
    if (ctx.state.user) return ctx.state.user;
    if (!candidateEmail) return null;
    const email = candidateEmail.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) return existing;
    return this.users.createLocalUser({
      usernameBase: email.split('@')[0],
      email,
      userRole,
      roleId: await this.users.findAuthenticatedRoleId(),
    });
  }
}
