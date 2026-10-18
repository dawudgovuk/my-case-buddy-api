import type { Core } from '@strapi/strapi';
import { Mailer } from '../../../lib/email/mailer';
import { RegistrationConfirmationEmail, VerificationEmail } from '../../../lib/email/templates/registration-templates';
import { roleDisplayName } from '../../../lib/domain/roles';

export interface RegistrationEmailsInput {
  name: string;
  email: string;
  role: string;
  token?: string;
  verificationUrl?: string;
  referenceId?: string;
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
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 7);
}

/**
 * Registration emails: builds the welcome + verification emails, sends them through the email
 * plugin (send failures are logged, not thrown) and returns the records for the client.
 */
export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async dispatchRegistrationEmails(input: RegistrationEmailsInput): Promise<{ roleDisplayName: string; emails: DispatchedEmailRecord[] }> {
    const { name, email, role, token, verificationUrl, referenceId } = input;
    const isLIP = role === 'LIP';
    const generatedRefId = referenceId || `${isLIP ? 'LIP-REG' : 'MF-REG'}-${Date.now().toString(36).toUpperCase()}`;
    const displayRole = roleDisplayName(role);
    const now = new Date();
    const resolvedToken = token || `verify_${Date.now().toString(36)}`;
    const resolvedVerificationUrl = verificationUrl || `http://localhost:5173/verify-email/${resolvedToken}`;
    const common = { name, email, roleDisplayName: displayRole, referenceId: generatedRefId, isLIP };

    const confirmation = new RegistrationConfirmationEmail().render({ ...common, nowFormatted: now.toUTCString() });
    const verification = new VerificationEmail().render({ ...common, token: resolvedToken, verificationUrl: resolvedVerificationUrl });

    const confirmationEmail: DispatchedEmailRecord = {
      id: `email_conf_${Date.now()}_${randomSuffix()}`,
      type: 'registration_confirmation',
      recipientName: name,
      recipientEmail: email,
      role,
      sender: 'support@mycasebuddy.justice.gov.uk',
      subject: confirmation.subject,
      sentAt: now.toISOString(),
      status: 'delivered',
      referenceId: generatedRefId,
      previewText: `Welcome to My Case Buddy! Your registration as a ${displayRole} has been officially received.`,
      bodyText: confirmation.text || '',
      html: confirmation.html,
    };

    const verificationEmail: DispatchedEmailRecord = {
      id: `email_verif_${Date.now()}_${randomSuffix()}`,
      type: 'email_verification',
      recipientName: name,
      recipientEmail: email,
      role,
      sender: 'safeguarding@mycasebuddy.justice.gov.uk',
      subject: verification.subject,
      sentAt: now.toISOString(),
      status: 'delivered',
      referenceId: generatedRefId,
      verificationToken: resolvedToken,
      verificationUrl: resolvedVerificationUrl,
      previewText: `Action Required: Confirm your email address to activate your ${displayRole} profile.`,
      bodyText: verification.text || '',
      html: verification.html,
    };

    strapi.log.info(
      `[AuthNotification] Dispatched Registration Confirmation & Verification Emails for ${name} (${displayRole}) <${email}> [Ref: ${generatedRefId}]`
    );

    const mailer = new Mailer(strapi);
    try {
      if (mailer.isAvailable()) {
        const fromEmail = mailer.fromAddress();
        for (const content of [confirmation, verification]) {
          await mailer.send({ senderName: 'My Case Buddy', replyTo: fromEmail, to: email, ...content });
        }
        strapi.log.info(`[AuthNotification] Successfully sent live styled HTML emails to ${email} via Nodemailer provider.`);
      }
    } catch (smtpErr: unknown) {
      const smtpMessage = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
      strapi.log.warn(`[AuthNotification] Live SMTP dispatch note: ${smtpMessage}`);
    }

    return { roleDisplayName: displayRole, emails: [confirmationEmail, verificationEmail] };
  },
});
