/**
 * Central place for environment-driven settings used across the API.
 * Values are read lazily so tests and different environments can change them.
 */
export const SUPPORT_EMAIL = 'support@mycasebuddy.justice.gov.uk';
export const SAFEGUARDING_EMAIL = 'safeguarding@mycasebuddy.justice.gov.uk';

/** Fallback used only when neither DEFAULT_FROM_EMAIL nor SMTP_USERNAME is configured. */
const FALLBACK_FROM_EMAIL = 'aliparvez20@gmail.com';
const FALLBACK_FRONTEND_URL = 'http://localhost:5173';

export const AppConfig = {
  frontendUrl(): string {
    return process.env.FRONTEND_URL || FALLBACK_FRONTEND_URL;
  },
  fromEmail(): string {
    return process.env.DEFAULT_FROM_EMAIL || process.env.SMTP_USERNAME || FALLBACK_FROM_EMAIL;
  },
} as const;

/** Invites issued with a peer-support request stay valid for 30 days. */
export const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
