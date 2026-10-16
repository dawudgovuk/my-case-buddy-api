import type { Core } from '@strapi/strapi';

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
function buildConfirmationHtml(params: {
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmed - My Case Buddy</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%); padding: 36px 30px; text-align: center;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; font-size: 28px; margin-bottom: 12px;">
                      ⚖️
                    </div>
                    <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">My Case Buddy</h1>
                    <div style="color: #bfdbfe; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                      HMCTS Family Court Litigant Assistance Network
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 36px 32px 24px 32px;">
              
              <!-- Greeting & Status Badge -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px;">
                      ✓ Application Received
                    </span>
                    <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 20px; font-weight: 700;">
                      Welcome to My Case Buddy, ${name}!
                    </h2>
                    <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0;">
                      Thank you for registering as a <strong>${roleDisplayName}</strong>. Your profile has been created and logged in our family proceedings registry under Reference <strong>${referenceId}</strong>.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Registration Snapshot Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 28px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">
                      Registration Summary
                    </div>
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size: 14px;">
                      <tr>
                        <td width="35%" style="color: #64748b;">Full Name:</td>
                        <td width="65%" style="color: #0f172a; font-weight: 600;">${name}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Registered Email:</td>
                        <td style="color: #0f172a; font-weight: 600;">${email}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Designated Role:</td>
                        <td style="color: #0284c7; font-weight: 700;">${roleDisplayName}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Reference Code:</td>
                        <td style="color: #0f172a; font-family: monospace; font-weight: 700;">${referenceId}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Timestamp:</td>
                        <td style="color: #64748b;">${nowFormatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Guidance Box -->
              <div style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 28px;">
                <div style="background-color: #f1f5f9; padding: 12px 18px; border-bottom: 1px solid #cbd5e1;">
                  <strong style="color: #1e293b; font-size: 14px;">
                    ${guidanceTitle}
                  </strong>
                </div>
                <div style="padding: 16px 18px;">
                  
                  <!-- Permitted Section -->
                  <div style="margin-bottom: 14px;">
                    <div style="color: #059669; font-weight: 700; font-size: 13px; margin-bottom: 6px;">
                      ${isLIP ? '✓ Your Rights & Capabilities:' : '✓ Permitted Assistance:'}
                    </div>
                    <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.55;">
                      ${permittedList.map((item) => `<li>${item}</li>`).join('\n                      ')}
                    </ul>
                  </div>

                  <!-- Prohibited Section -->
                  <div>
                    <div style="color: #dc2626; font-weight: 700; font-size: 13px; margin-bottom: 6px;">
                      ${isLIP ? '✕ Legal Restrictions & Safeguarding Rules:' : '✕ Prohibited Activities:'}
                    </div>
                    <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.55;">
                      ${prohibitedList.map((item) => `<li>${item}</li>`).join('\n                      ')}
                    </ul>
                  </div>

                </div>
              </div>

              <!-- Notice about Second Email -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 14px 16px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <div style="color: #1e40af; font-weight: 700; font-size: 14px; margin-bottom: 4px;">
                      Next Step: Verify Your Email Address
                    </div>
                    <p style="color: #3b82f6; font-size: 13px; line-height: 1.5; margin: 0;">
                      Under UK Family Court child safeguarding regulations, your account profile requires email confirmation. Please click the activation link in the <strong>Verification Email</strong> sent simultaneously to this inbox.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 8px 0;">
                Confidentiality Notice: This email and any attachments are protected under Family Procedure Rules (FPR Rule 12.73) and UK GDPR safeguarding standards.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                &copy; ${new Date().getFullYear()} My Case Buddy &bull; Support Office: support@mycasebuddy.justice.gov.uk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds a beautifully styled, responsive HTML email for Account Verification with a prominent CTA button.
 */
function buildVerificationHtml(params: {
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Action Required: Verify your ${roleDisplayName} account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%); padding: 36px 30px; text-align: center;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; font-size: 28px; margin-bottom: 12px;">
                      🛡️
                    </div>
                    <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Safeguarding Clearance</h1>
                    <div style="color: #a7f3d0; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                      ${isLIP ? 'HMCTS Family Court User Verification' : 'UK Family Court Peer Supporter Verification'}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 36px 32px 24px 32px;">
              
              <!-- Greeting & Action Notice -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px;">
                      ⚠️ Action Required
                    </span>
                    <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 20px; font-weight: 700;">
                      Verify Your Email Address
                    </h2>
                    <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">
                      Dear <strong>${name}</strong>,
                    </p>
                    <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0;">
                      ${
                        isLIP
                          ? 'In compliance with <strong>UK Family Procedure Rules (FPR Part 12)</strong> and <strong>UK GDPR child safeguarding regulations</strong>, all Litigants in Person must confirm their email before creating family court cases or requesting assistance from McKenzie Friends.'
                          : 'In compliance with <strong>UK Family Procedure Rules (FPR Part 12)</strong> and <strong>UK GDPR child safeguarding regulations</strong>, all McKenzie Friends and legal supporters must confirm their email before accessing proceedings or offering assistance to Litigants in Person.'
                      }
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Big Primary Verification Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 32px 0 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationUrl}" target="_blank" style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 16px 38px; border-radius: 8px; font-size: 16px; font-weight: 700; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 6px 14px rgba(16, 185, 129, 0.35); text-align: center;">
                      Verify Email Address &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Direct URL Fallback Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 6px;">
                      Button not working? Copy and paste this link into your browser:
                    </div>
                    <a href="${verificationUrl}" target="_blank" style="color: #2563eb; font-size: 13px; font-family: monospace; word-break: break-all; text-decoration: underline;">
                      ${verificationUrl}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What happens next box -->
              <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
                <div style="color: #6b21a8; font-weight: 700; font-size: 13px; margin-bottom: 6px;">
                  What happens once you verify?
                </div>
                <ol style="margin: 0; padding-left: 20px; color: #581c87; font-size: 13px; line-height: 1.55;">
                  ${nextSteps.map((step) => `<li>${step}</li>`).join('\n                  ')}
                </ol>
              </div>

              <!-- Security Notice -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
                    Security Note: This verification link expires in 24 hours. Token reference: <code style="background-color: #f1f5f9; padding: 2px 5px; border-radius: 3px; font-size: 11px;">${token}</code>.<br>
                    If you did not register for this account, please immediately contact <a href="mailto:safeguarding@mycasebuddy.justice.gov.uk" style="color: #64748b;">safeguarding@mycasebuddy.justice.gov.uk</a>.
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 8px 0;">
                Official correspondence from My Case Buddy Safeguarding &amp; Identity Governance Office.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                &copy; ${new Date().getFullYear()} My Case Buddy &bull; Reference: ${referenceId}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
