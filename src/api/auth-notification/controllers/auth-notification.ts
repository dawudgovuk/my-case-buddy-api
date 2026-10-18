import type { Core } from '@strapi/strapi';
import type { RegistrationEmailsInput } from '../services/auth-notification';

interface NotificationContext {
  request: { body?: Partial<RegistrationEmailsInput> };
  badRequest(message: string): unknown;
  internalServerError(message: string): unknown;
  send(body: unknown): unknown;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * POST /api/auth-notification/send-registration-emails
   * Sends the registration confirmation and verification emails for a new account.
   */
  async sendRegistrationEmails(ctx: NotificationContext) {
    try {
      const { name, email, role = 'LIP', token, verificationUrl, referenceId } = ctx.request.body || {};
      if (!name || !email) {
        return ctx.badRequest('Missing required fields: name and email are mandatory');
      }

      const result = await strapi
        .service('api::auth-notification.auth-notification')
        .dispatchRegistrationEmails({ name, email, role, token, verificationUrl, referenceId });

      return ctx.send({
        success: true,
        message: `Both confirmation and verification emails successfully generated and dispatched for ${result.roleDisplayName}.`,
        emails: result.emails,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process email dispatch';
      strapi.log.error(`[AuthNotification] Error processing registration emails: ${message}`);
      return ctx.internalServerError(message);
    }
  },
});
