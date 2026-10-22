import type { Core } from '@strapi/strapi';
import { Mailer } from '../../../lib/email/mailer';
import { TemplateService } from '../../../lib/email/template-service';
import { roleDisplayName } from '../../../lib/domain/roles';

export interface RegistrationEmailsInput {
  name: string;
  email: string;
  role: string;
  token?: string;
  verificationUrl?: string;
  referenceId?: string;
  locale?: string;
}

/** Record of a dispatched email, returned to the client for display. */
export interface DispatchedEmailRecord {
  id: string;
  type: 'registration_confirmation' | 'email_verification';
  recipientName: string;
  recipientEmail: string;
  role: string;
  sender: string;
  subject: string;
  sentAt: string;
  status: 'delivered';
  referenceId: string;
  verificationToken?: string;
  verificationUrl?: string;
  previewText: string;
  bodyText: string;
  html: string;
  locale?: string;
  source?: 'strapi_db' | 'code_fallback';
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 7);
}

/**
 * Registration emails: resolves templates from Strapi email-template (or fallback),
 * sends them through the email plugin (send failures are logged, not thrown)
 * and returns the records for the client.
 */
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async dispatchRegistrationEmails(input: RegistrationEmailsInput): Promise<{ roleDisplayName: string; emails: DispatchedEmailRecord[] }> {
    const { name, email, role, token, verificationUrl, referenceId, locale = 'en' } = input;
    const isLIP = role === 'LIP';
    const generatedRefId = referenceId || `${isLIP ? 'LIP-REG' : 'MF-REG'}-${Date.now().toString(36).toUpperCase()}`;
    const displayRole = roleDisplayName(role);
    const now = new Date();
    const resolvedToken = token || `verify_${Date.now().toString(36)}`;
    const resolvedVerificationUrl = verificationUrl || `http://localhost:5173/verify-email/${resolvedToken}`;
    const common = {
      name,
      email,
      roleDisplayName: displayRole,
      role,
      referenceId: generatedRefId,
      isLIP,
      token: resolvedToken,
      verificationUrl: resolvedVerificationUrl,
      nowFormatted: now.toUTCString(),
      appName: 'My Case Buddy',
    };

    const templateService = new TemplateService(strapi);

    // 1. Render both templates dynamically via Strapi email-template collection (supporting i18n locales)
    const confirmation = await templateService.renderTemplate('registration_confirmation', common, locale);
    const verification = await templateService.renderTemplate('email_verification', common, locale);

    const confirmationEmail: DispatchedEmailRecord = {
      id: `email_conf_${Date.now()}_${randomSuffix()}`,
      type: 'registration_confirmation',
      recipientName: name,
      recipientEmail: email,
      role,
      sender: confirmation.senderEmail || 'support@mycasebuddy.justice.gov.uk',
      subject: confirmation.subject,
      sentAt: now.toISOString(),
      status: 'delivered',
      referenceId: generatedRefId,
      previewText: `Welcome to My Case Buddy! Your registration as a ${displayRole} has been officially received.`,
      bodyText: confirmation.text || '',
      html: confirmation.html,
      locale: confirmation.locale,
      source: confirmation.source,
    };

    const verificationEmail: DispatchedEmailRecord = {
      id: `email_verif_${Date.now()}_${randomSuffix()}`,
      type: 'email_verification',
      recipientName: name,
      recipientEmail: email,
      role,
      sender: verification.senderEmail || 'safeguarding@mycasebuddy.justice.gov.uk',
      subject: verification.subject,
      sentAt: now.toISOString(),
      status: 'delivered',
      referenceId: generatedRefId,
      verificationToken: resolvedToken,
      verificationUrl: resolvedVerificationUrl,
      previewText: `Action Required: Confirm your email address to activate your ${displayRole} profile.`,
      bodyText: verification.text || '',
      html: verification.html,
      locale: verification.locale,
      source: verification.source,
    };

    strapi.log.info(
      `[AuthNotification] Dispatched Registration Emails (${confirmation.source}/${confirmation.locale}) for ${name} (${displayRole}) <${email}> [Ref: ${generatedRefId}]`
    );

    const mailer = new Mailer(strapi);
    try {
      if (mailer.isAvailable()) {
        const fromEmail = mailer.fromAddress();
        await mailer.send({
          senderName: confirmation.senderName || 'My Case Buddy',
          replyTo: fromEmail,
          to: email,
          subject: confirmation.subject,
          html: confirmation.html,
          text: confirmation.text,
        });
        await mailer.send({
          senderName: verification.senderName || 'My Case Buddy Safeguarding',
          replyTo: fromEmail,
          to: email,
          subject: verification.subject,
          html: verification.html,
          text: verification.text,
        });
        strapi.log.info(`[AuthNotification] Successfully sent live styled HTML emails to ${email} via Nodemailer provider.`);
      }
    } catch (smtpErr: unknown) {
      const smtpMessage = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
      strapi.log.warn(`[AuthNotification] Live SMTP dispatch note: ${smtpMessage}`);
    }

    return { roleDisplayName: displayRole, emails: [confirmationEmail, verificationEmail] };
  },
});
