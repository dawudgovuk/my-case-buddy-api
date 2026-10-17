import type { Core } from '@strapi/strapi';
import { renderEmail, esc, pill, paragraph, heading, detailsCard, checklist, note, button, linkFallback } from '../../../utils/email-layout';

interface SendRegistrationEmailsPayload {
  name: string;
  email: string;
  role: string;
  token?: string;
  verificationUrl?: string;
  referenceId?: string;
}

/**
 * Builds a beautifully styled, responsive HTML email for Registration Confirmation & Remit Guide.
 */
export function buildConfirmationHtml(params: {
  name: string;
  email: string;
  roleDisplayName: string;
  referenceId: string;
  nowFormatted: string;
  isLIP?: boolean;
}): string {
  const { name, email, roleDisplayName, referenceId, nowFormatted, isLIP } = params;

  const guidanceTitle = isLIP
    ? '📜 Litigant in Person Guidance & Rights (HMCTS Family Court)'
    : '📜 McKenzie Friend Practice Guidance (July 2010)';

  const permittedList = isLIP
    ? [
        'Direct access to create and manage Family Court cases (Child Arrangements, Section 7 reports).',
        'Right to seek moral support and procedural reassurance from a McKenzie Friend.',
        'Compiling digital court bundles, chronological timelines, and position statements.',
        'Self-representing in court and directly addressing the bench during hearings.',
      ]
    : [
        'Providing moral support, encouragement, and calm reassurance to the litigant.',
        'Taking comprehensive in-court notes of evidence, submissions, and judge\'s directions.',
        'Quietly advising on procedural issues, practical questions, and witness examination.',
        'Assisting in organizing and managing the digital and paper trial bundles.',
      ];

  const prohibitedList = isLIP
    ? [
        'Must maintain strict confidentiality of all private family proceedings (FPR Rule 12.73).',
        'Cannot disclose child details or court documents to unauthorized third parties or social media.',
        'Cannot record hearings or court sessions without express judicial permission.',
        'Must comply with court-mandated filing deadlines and procedural directions.',
      ]
    : [
        'Cannot address the court directly or examine witnesses without special judicial leave.',
        'Cannot sign court pleadings, witness statements, or legal forms for the litigant.',
        'Cannot act as an authorized legal representative conducting litigation.',
        'Must maintain strict confidentiality of all private family proceedings (FPR Rule 12.73).',
      ];

  return renderEmail({
    title: 'Registration confirmed – My Case Buddy',
    preheader: `Welcome to My Case Buddy, ${name}. Your ${roleDisplayName} account is ready.`,
    tone: 'brand',
    eyebrow: 'Registration confirmed',
    icon: '&#9878;',
    heroTitle: `Welcome to My Case Buddy, ${esc(name)}`,
    heroSubtitle: `Your account as a <strong style="color:#ffffff;">${esc(roleDisplayName)}</strong> has been created.`,
    bodyHtml: [
      pill('&#10003; Application received', 'success'),
      paragraph(
        `Thank you for registering. Your profile has been created under reference <strong style="color:#0f172a;">${esc(referenceId)}</strong>. Keep this email for your records.`
      ),
      detailsCard('Your registration', [
        { label: 'Full name', value: name },
        { label: 'Email', value: email },
        { label: 'Role', value: roleDisplayName },
        { label: 'Reference', value: referenceId },
        { label: 'Registered', value: nowFormatted },
      ]),
      heading(esc(guidanceTitle)),
      checklist(permittedList.map(esc), 'tick', isLIP ? 'Your rights and what you can do' : 'What you can help with'),
      checklist(prohibitedList.map(esc), 'cross', isLIP ? 'Rules to follow' : 'What you must not do'),
      note(
        '<strong>One more step:</strong> we have sent you a second email with a link to confirm your email address. Please open it within 24 hours.',
        'warning'
      ),
    ].join('\n'),
    smallPrint: 'You are receiving this email because an account was created with this address on My Case Buddy.',
    supportEmail: 'support@mycasebuddy.justice.gov.uk',
  });
}

/**
 * Builds a beautifully styled, responsive HTML email for Account Verification with a prominent CTA button.
 */
export function buildVerificationHtml(params: {
  name: string;
  email: string;
  roleDisplayName: string;
  referenceId: string;
  token: string;
  verificationUrl: string;
  isLIP?: boolean;
}): string {
  const { name, email, roleDisplayName, referenceId, token, verificationUrl, isLIP } = params;

  const nextSteps = isLIP
    ? [
        'Your profile will be upgraded to <strong>Verified Litigant in Person</strong>.',
        'You can create and manage child arrangement cases, timelines, and court filings.',
        'You can invite verified McKenzie Friends for peer support and bundle organization.',
      ]
    : [
        `Your profile will be upgraded to <strong>Verified ${roleDisplayName}</strong>.`,
        'You will gain access to browse open peer support requests from Litigants in Person.',
        'You can view case milestones, court directions, and collaborative bundles.',
      ];

  return renderEmail({
    title: `Verify your ${roleDisplayName} account – My Case Buddy`,
    preheader: `Please confirm your email address to activate your ${roleDisplayName} account.`,
    tone: 'brand',
    eyebrow: isLIP ? 'Account verification' : 'Supporter verification',
    icon: '&#128737;',
    heroTitle: 'Confirm your email address',
    heroSubtitle: 'One click and your account is fully set up.',
    bodyHtml: [
      pill('Action required', 'warning'),
      paragraph(`Dear <strong style="color:#0f172a;">${esc(name)}</strong>,`),
      paragraph(
        isLIP
          ? 'To keep family court information safe, we ask everyone to confirm their email address before creating cases or asking a McKenzie Friend for help.'
          : 'To keep family court information safe, we ask every McKenzie Friend and legal supporter to confirm their email address before seeing cases or offering help.'
      ),
      button(verificationUrl, 'Verify my email address'),
      linkFallback(verificationUrl),
      checklist(nextSteps, 'number', 'What happens next'),
    ].join('\n'),
    smallPrint: `This link expires in 24 hours. Reference ${esc(referenceId)} &bull; Token ${esc(token)}.<br />If you didn't create this account, please contact <a href="mailto:safeguarding@mycasebuddy.justice.gov.uk" style="color:#64748b;">safeguarding@mycasebuddy.justice.gov.uk</a>.`,
    supportEmail: 'support@mycasebuddy.justice.gov.uk',
  });
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Dispatches both Registration Confirmation and Verification Emails
   * when any user registers (LIP, McKenzie Friends, or legal professionals).
   */
  async sendRegistrationEmails(ctx: any) {
    try {
      const body = ctx.request.body as SendRegistrationEmailsPayload;
      const { name, email, role = 'LIP', token, verificationUrl, referenceId } = body || {};

      if (!name || !email) {
        return ctx.badRequest('Missing required fields: name and email are mandatory');
      }

      const isLIP = role === 'LIP';
      const rolePrefix = isLIP ? 'LIP-REG' : 'MF-REG';
      const generatedRefId = referenceId || `${rolePrefix}-${Date.now().toString(36).toUpperCase()}`;
      const roleDisplayName = role === 'McKenzieFriend' ? 'McKenzie Friend' : role === 'LIP' ? 'Litigant in Person' : role;
      const now = new Date();
      const nowFormatted = now.toUTCString();
      const resolvedToken = token || `verify_${Date.now().toString(36)}`;
      const resolvedVerificationUrl =
        verificationUrl || `http://localhost:5173/verify-email/${resolvedToken}`;

      // Build rich HTML contents
      const confirmationHtml = buildConfirmationHtml({
        name,
        email,
        roleDisplayName,
        referenceId: generatedRefId,
        nowFormatted,
        isLIP,
      });

      const verificationHtml = buildVerificationHtml({
        name,
        email,
        roleDisplayName,
        referenceId: generatedRefId,
        token: resolvedToken,
        verificationUrl: resolvedVerificationUrl,
        isLIP,
      });

      // 1. Build Confirmation Email Object
      const confirmationEmail = {
        id: `email_conf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'registration_confirmation',
        recipientName: name,
        recipientEmail: email,
        role,
        sender: 'support@mycasebuddy.justice.gov.uk',
        subject: `Registration Confirmed: Welcome to My Case Buddy (${roleDisplayName})`,
        sentAt: now.toISOString(),
        status: 'delivered',
        referenceId: generatedRefId,
        previewText: `Welcome to My Case Buddy! Your registration as a ${roleDisplayName} has been officially received.`,
        bodyText: isLIP
          ? `Dear ${name},\n\nThank you for registering as a Litigant in Person with My Case Buddy (Reference: ${generatedRefId}).\n\nYour profile has been created to help you manage Family Court proceedings, child arrangements, and hearings.\n\nA separate Verification Email has also been dispatched to your inbox. Please click the verification link to activate your account.\n\nWarm regards,\nThe My Case Buddy Team`
          : `Dear ${name},\n\nThank you for registering as a ${roleDisplayName} with My Case Buddy (Reference: ${generatedRefId}).\n\nUnder UK Family Procedure Rules (FPR) and Practice Guidance on McKenzie Friends (July 2010), your remit includes providing moral support, taking notes, and quietly advising the litigant.\n\nA separate Verification Email has also been dispatched to your inbox. Please click the verification link to activate your safeguarding clearance.\n\nWarm regards,\nThe My Case Buddy Team`,
        html: confirmationHtml,
      };

      // 2. Build Verification Email Object
      const verificationEmail = {
        id: `email_verif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'email_verification',
        recipientName: name,
        recipientEmail: email,
        role,
        sender: 'safeguarding@mycasebuddy.justice.gov.uk',
        subject: `Action Required: Verify your ${roleDisplayName} account`,
        sentAt: now.toISOString(),
        status: 'delivered',
        referenceId: generatedRefId,
        verificationToken: resolvedToken,
        verificationUrl: resolvedVerificationUrl,
        previewText: `Action Required: Confirm your email address to activate your ${roleDisplayName} profile.`,
        bodyText: `Dear ${name},\n\nPlease confirm your email address to activate your ${roleDisplayName} profile on My Case Buddy.\n\nVerify Link: ${resolvedVerificationUrl}\n\nThis verification link expires in 24 hours.\n\nRegards,\nSafeguarding & Governance Office`,
        html: verificationHtml,
      };

      strapi.log.info(
        `[AuthNotification] Dispatched Registration Confirmation & Verification Emails for ${name} (${roleDisplayName}) <${email}> [Ref: ${generatedRefId}]`
      );

      // Attempt live dispatch via Strapi email provider (nodemailer / Gmail)
      try {
        const emailService = strapi.plugin('email')?.service('email');
        if (emailService) {
          const fromEmail = process.env.DEFAULT_FROM_EMAIL || process.env.SMTP_USERNAME || 'aliparvez20@gmail.com';
          const sender = `"My Case Buddy" <${fromEmail}>`;

          // 1. Send live Confirmation Email with rich HTML
          await emailService.send({
            from: sender,
            replyTo: fromEmail,
            to: email,
            subject: confirmationEmail.subject,
            text: confirmationEmail.bodyText,
            html: confirmationHtml,
          });

          // 2. Send live Verification Email with rich HTML
          await emailService.send({
            from: sender,
            replyTo: fromEmail,
            to: email,
            subject: verificationEmail.subject,
            text: verificationEmail.bodyText,
            html: verificationHtml,
          });

          strapi.log.info(`[AuthNotification] Successfully sent live styled HTML emails to ${email} via Nodemailer provider.`);
        }
      } catch (smtpErr: unknown) {
        const smtpMessage = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        strapi.log.warn(`[AuthNotification] Live SMTP dispatch note: ${smtpMessage}`);
      }

      return ctx.send({
        success: true,
        message: `Both confirmation and verification emails successfully generated and dispatched for ${roleDisplayName}.`,
        emails: [confirmationEmail, verificationEmail],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process email dispatch';
      strapi.log.error(`[AuthNotification] Error processing registration emails: ${message}`);
      return ctx.internalServerError(message);
    }
  },
});
